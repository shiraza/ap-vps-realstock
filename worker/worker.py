"""
iPhone在庫監視 Pythonワーカー

処理フロー:
1. while True で time.sleep(20) ごとにループ実行
2. supabase-py で watch_areas と watch_products から is_active=true のデータを取得
3. watch_areas の各 postal_code ごとにループし、全 part_number をパラメータとして
   Apple Fulfillment API にGETリクエストを送信
4. 取得した各店舗・各パーツの在庫ステータスを stock_matrix テーブルに upsert
5. ステータスが UNAVAILABLE → AVAILABLE に変化した場合、
   対象ユーザーにLINE通知を送信

環境変数（.envから読み込み）:
  SUPABASE_URL          - SupabaseのURL
  SUPABASE_SERVICE_KEY  - SupabaseのService Role Key
  PROXY_HOST            - SmartProxyのホスト
  PROXY_PORT            - SmartProxyのポート
  PROXY_USER            - SmartProxyのユーザー名
  PROXY_PASS            - SmartProxyのパスワード
  NOTIFY_API_URL        - Next.js通知APIのURL
  NOTIFY_API_SECRET     - 通知API認証シークレット
"""

import os
import time
import json
import logging
from datetime import datetime, timezone
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================
# ログ設定
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ============================================================
# 環境変数の読み込み
# ============================================================
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
PROXY_HOST = os.getenv("PROXY_HOST", "")
PROXY_PORT = os.getenv("PROXY_PORT", "")
PROXY_USER = os.getenv("PROXY_USER", "")
PROXY_PASS = os.getenv("PROXY_PASS", "")

# LINE通知API設定
NOTIFY_API_URL = os.getenv("NOTIFY_API_URL", "")
NOTIFY_API_SECRET = os.getenv("NOTIFY_API_SECRET", "")

# Apple Fulfillment API のベースURL
# 旧プロジェクト（iphone-stock）で動作実績のあるエンドポイント
APPLE_API_BASE = "https://www.apple.com/jp/shop/retail/pickup-message"

# User-Agent（ボット検知対策）
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# APIリクエストのタイムアウト（秒）
REQUEST_TIMEOUT = 20

# デフォルトのループ待機時間（秒）— DBから動的に取得する
DEFAULT_POLL_INTERVAL = 20

# 1回のAPIリクエストあたりの最大パーツ数（Apple APIの制限対策）
BATCH_SIZE = 3

# バッチ間の待機時間（秒）— レート制限回避
BATCH_DELAY = 2

# ============================================================
# インメモリ ステータスキャッシュ
# キー: "{part_number}:{store_id}", 値: ステータス文字列
# 起動時にDBから前回ステータスを読み込むことで、
# 再起動後も正しく状態変化を検知できる
# ============================================================
last_status_cache: dict[str, str] = {}
# 初回サイクルフラグ（DBからキャッシュ読み込み済みの場合はFalse）
is_first_cycle = True


# ============================================================
# Supabaseクライアント初期化
# ============================================================
def init_supabase() -> Client:
    """Supabaseクライアントを初期化する"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError(
            "SUPABASE_URL と SUPABASE_SERVICE_KEY を .env に設定してください"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_initial_cache(supabase: Client) -> int:
    """
    起動時にDBの stock_matrix から前回のステータスをキャッシュに読み込む。

    これにより、ワーカー再起動後も前回の状態との差分を正しく検知でき、
    「UNAVAILABLE → AVAILABLE」のような在庫復活を見逃さない。
    """
    global last_status_cache, is_first_cycle
    try:
        res = (
            supabase.table("stock_matrix")
            .select("part_number, store_id, status")
            .execute()
        )
        rows = res.data or []
        for row in rows:
            key = f"{row['part_number']}:{row['store_id']}"
            last_status_cache[key] = row["status"]

        if rows:
            # DBにデータがある場合、初回サイクルフラグを解除
            # → 次のサイクルから即座に状態変化を検知可能
            is_first_cycle = False
            logger.info(
                f"📋 DBから初期キャッシュを読み込みました: {len(rows)} 件\n"
                f"   → 次のサイクルから在庫変化を検知します"
            )
        else:
            logger.info(
                "📋 DBにまだ在庫データがありません（初回サイクルとして扱います）"
            )
        return len(rows)
    except Exception as e:
        logger.warning(f"⚠️ 初期キャッシュの読み込みに失敗: {e}")
        return 0


# ============================================================
# Proxy設定
# ============================================================
def get_proxies() -> dict:
    """
    SmartProxyのプロキシ設定を構築する

    【重要】プロキシは必須です。
    自分のIPアドレスでApple APIを直接叩くことは禁止されています。
    プロキシ設定が不完全な場合はエラーで停止します。
    """
    if not PROXY_HOST or not PROXY_PORT or not PROXY_USER or not PROXY_PASS:
        raise ValueError(
            "❌ プロキシ設定が不完全です。\n"
            "   自IPでのApple APIアクセスは禁止されています。\n"
            "   .env に以下を設定してください:\n"
            "   PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS"
        )

    proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"
    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def get_direct_ip() -> str | None:
    """
    プロキシなしで自分のIPアドレスを取得する（起動時チェック用）
    """
    try:
        res = requests.get("https://httpbin.org/ip", timeout=10)
        res.raise_for_status()
        return res.json().get("origin", "")
    except Exception:
        return None


def verify_proxy_ip(proxies: dict, direct_ip: str | None = None) -> str | None:
    """
    プロキシ経由で現在のIPアドレスを取得・表示する
    direct_ip が指定されている場合、プロキシIPと一致しないことを検証する
    （一致 = プロキシが機能していない → 即座にエラー停止）
    """
    try:
        res = requests.get(
            "https://httpbin.org/ip",
            proxies=proxies,
            timeout=10,
        )
        res.raise_for_status()
        proxy_ip = res.json().get("origin", "不明")
        logger.info(f"🌐 プロキシIP確認: {proxy_ip}")

        # 自IPとプロキシIPが一致する場合、プロキシが機能していない
        if direct_ip and proxy_ip == direct_ip:
            raise RuntimeError(
                f"🚨 致命的エラー: プロキシIPが自IPと一致しています！\n"
                f"   自IP: {direct_ip}\n"
                f"   プロキシIP: {proxy_ip}\n"
                f"   → プロキシが正しく機能していません。ワーカーを停止します。"
            )

        return proxy_ip
    except RuntimeError:
        raise  # RuntimeErrorはそのまま上位に伝播
    except Exception as e:
        logger.warning(f"⚠️ プロキシIP確認に失敗（動作には影響なし）: {e}")
        return None


# ============================================================
# Apple API
# ============================================================
def build_api_url(part_numbers: list[str], postal_code: str) -> str:
    """
    Apple Fulfillment API の URL を構築する

    旧プロジェクトの動作実績に基づくパラメータ構成:
      pl=true, parts.0=XXX, location=POSTAL_CODE
    """
    params = []
    params.append("pl=true")
    for i, pn in enumerate(part_numbers):
        params.append(f"parts.{i}={quote(pn, safe='')}")
    params.append(f"location={quote(postal_code, safe='')}")
    return f"{APPLE_API_BASE}?{'&'.join(params)}"


def fetch_stock_from_apple(
    part_numbers: list[str],
    postal_code: str,
    proxies: dict,
) -> dict | None:
    """
    Apple Fulfillment API から在庫情報を取得する

    【重要】proxies は必須。None や空辞書は絶対に許可しない。
    戻り値: APIレスポンスのJSON（辞書）またはNone（エラー時）
    """
    # ========== 防御層: プロキシなしでのリクエストを絶対に許可しない ==========
    if not proxies or "https" not in proxies:
        logger.critical(
            "🚨 致命的エラー: プロキシ設定なしでApple APIを呼び出そうとしました！\n"
            "   自IPでのアクセスは禁止されています。リクエストを中止します。"
        )
        raise RuntimeError("プロキシなしでのApple APIアクセスは禁止されています")
    # =====================================================================

    url = build_api_url(part_numbers, postal_code)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "ja-JP,ja;q=0.9",
        "Referer": "https://www.apple.com/jp/shop/buy-iphone",
    }

    try:
        logger.info(f"📡 Apple APIリクエスト送信 (郵便番号: {postal_code}, パーツ数: {len(part_numbers)})")
        response = requests.get(
            url,
            headers=headers,
            proxies=proxies,
            timeout=REQUEST_TIMEOUT,
        )

        # エラー時はレスポンスボディも表示（デバッグ用）
        if not response.ok:
            body_preview = response.text[:500] if response.text else "(空)"
            logger.error(
                f"❌ Apple API HTTPエラー: {response.status_code}\n"
                f"   URL: {url}\n"
                f"   レスポンス: {body_preview}"
            )
            return None

        data = response.json()
        store_count = len(data.get("body", {}).get("stores", []))
        logger.info(f"✅ Apple API応答受信 ({store_count} 店舗)")
        return data

    except requests.exceptions.Timeout:
        logger.error(f"⏰ Apple APIリクエストがタイムアウトしました ({REQUEST_TIMEOUT}秒)")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Apple APIリクエストエラー: {e}")
        return None
    except json.JSONDecodeError:
        logger.error("❌ Apple APIレスポンスのJSONパースに失敗しました")
        return None


# ============================================================
# 通知対象ユーザーの取得
# ============================================================
def get_notification_targets(
    supabase: Client,
    part_number: str,
    store_id: str,
) -> list[str]:
    """
    指定されたpart_number + store_idに対する通知対象のLINEユーザーIDリストを取得する

    user_monitoring_conditions と notification_users を結合し、
    is_active=true のユーザーの line_user_id を返す。

    Args:
        supabase: Supabaseクライアント
        part_number: 在庫復活した商品のパーツ番号
        store_id: 在庫復活した店舗のID（例: "R381"）

    Returns:
        通知対象のline_user_idリスト
    """
    try:
        # user_monitoring_conditions から対象の user_id を取得
        conditions_res = (
            supabase.table("user_monitoring_conditions")
            .select("user_id")
            .eq("part_number", part_number)
            .eq("store_id", store_id)
            .execute()
        )
        conditions = conditions_res.data or []

        if not conditions:
            return []

        # 対象ユーザーIDのリスト
        user_ids = [c["user_id"] for c in conditions]

        # notification_users からアクティブなユーザーの line_user_id を取得
        users_res = (
            supabase.table("notification_users")
            .select("line_user_id")
            .in_("id", user_ids)
            .eq("is_active", True)
            .execute()
        )
        users = users_res.data or []

        return [u["line_user_id"] for u in users]

    except Exception as e:
        logger.error(f"❌ 通知対象ユーザーの取得エラー: {e}")
        return []


# ============================================================
# Next.js 通知APIへのリクエスト送信
# ============================================================
def send_notification(
    model_name: str,
    store_name: str,
    part_number: str,
    target_line_user_ids: list[str],
) -> bool:
    """
    Next.js の通知API (/api/notify) にPOSTリクエストを送信する

    Args:
        model_name: モデル名（例: "iPhone 17 Pro Max 256GB シルバー"）
        store_name: 店舗名（例: "Apple 銀座"）
        part_number: パーツ番号（例: "MFY84J/A"）
        target_line_user_ids: 通知対象のLINEユーザーIDリスト

    Returns:
        送信成功: True, 失敗: False
    """
    if not NOTIFY_API_URL:
        logger.warning("⚠️ NOTIFY_API_URL が設定されていません。通知をスキップします。")
        return False

    if not NOTIFY_API_SECRET:
        logger.warning("⚠️ NOTIFY_API_SECRET が設定されていません。通知をスキップします。")
        return False

    try:
        response = requests.post(
            NOTIFY_API_URL,
            json={
                "modelName": model_name,
                "storeName": store_name,
                "partNumber": part_number,
                "targetLineUserIds": target_line_user_ids,
            },
            headers={
                "Authorization": f"Bearer {NOTIFY_API_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        if response.ok:
            result = response.json()
            logger.info(
                f"📨 LINE通知送信成功: 送信={result.get('sent', 0)}, "
                f"失敗={result.get('failed', 0)}"
            )
            return True
        else:
            logger.error(
                f"❌ 通知API HTTPエラー: {response.status_code} "
                f"- {response.text[:200]}"
            )
            return False

    except Exception as e:
        logger.error(f"❌ 通知APIリクエストエラー: {e}")
        return False


# ============================================================
# 在庫データの解析とUpsert（状態変化検知付き）
# ============================================================
def parse_and_upsert(
    supabase: Client,
    api_response: dict,
    part_numbers: list[str],
    area_stores: list[dict],
    product_info_map: dict[str, dict],
) -> int:
    """
    Apple APIレスポンスを解析し、stock_matrixにupsertする
    ステータス変化（UNAVAILABLE → AVAILABLE）を検知した場合は通知を送信する

    Args:
        supabase: Supabaseクライアント
        api_response: Apple APIのJSONレスポンス
        part_numbers: 対象パーツ番号リスト
        area_stores: エリアの店舗リスト [{store_id, store_name}, ...]
        product_info_map: パーツ番号 → 商品情報のマップ

    Returns:
        upsert件数
    """
    global last_status_cache, is_first_cycle

    stores_data = api_response.get("body", {}).get("stores", [])
    if not stores_data:
        logger.warning("⚠️ APIレスポンスに店舗データが含まれていません")
        return 0

    # エリアの店舗IDセットを作成（高速ルックアップ用）
    target_store_ids = {s["store_id"] for s in area_stores}
    # 店舗名マップ
    store_name_map = {s["store_id"]: s["store_name"] for s in area_stores}

    upsert_rows = []
    now = datetime.now(timezone.utc).isoformat()

    # 在庫復活を検知した場合の通知情報を蓄積
    # キー: part_number, 値: 復活した店舗情報 (store_id, store_name) のリスト
    stock_alerts: dict[str, list[tuple[str, str]]] = {}

    for store in stores_data:
        store_number = store.get("storeNumber", "")
        if store_number not in target_store_ids:
            continue

        store_name = store_name_map.get(store_number, store.get("storeName", "不明"))
        parts_availability = store.get("partsAvailability", {})

        for pn in part_numbers:
            part_info = parts_availability.get(pn)
            if part_info:
                status = part_info.get("pickupDisplay", "UNKNOWN").upper()
            else:
                status = "UNKNOWN"

            # ---- 状態変化の検知 ----
            cache_key = f"{pn}:{store_number}"
            old_status = last_status_cache.get(cache_key)

            # 非AVAILABLE → AVAILABLE への変化を検知（初回サイクルは除外）
            if (
                not is_first_cycle
                and old_status is not None
                and old_status != "AVAILABLE"
                and status == "AVAILABLE"
            ):
                logger.info(
                    f"🔔 在庫復活検知! {pn} @ {store_name} "
                    f"({old_status} → {status})"
                )
                if pn not in stock_alerts:
                    stock_alerts[pn] = []
                stock_alerts[pn].append((store_number, store_name))
            elif old_status is not None and old_status != status:
                # AVAILABLE → UNAVAILABLE などの変化もログ出力（デバッグ用）
                logger.debug(
                    f"📊 ステータス変化: {pn} @ {store_name} "
                    f"({old_status} → {status})"
                )

            # キャッシュを更新
            last_status_cache[cache_key] = status

            upsert_rows.append({
                "part_number": pn,
                "store_id": store_number,
                "store_name": store_name,
                "status": status,
                "updated_at": now,
            })

    if not upsert_rows:
        logger.warning("⚠️ upsert対象のデータがありません")
        return 0

    try:
        # stock_matrix に upsert（複合PK: part_number + store_id）
        supabase.table("stock_matrix").upsert(
            upsert_rows,
            on_conflict="part_number,store_id",
        ).execute()
        logger.info(f"💾 stock_matrix に {len(upsert_rows)} 件 upsert 完了")

    except Exception as e:
        logger.error(f"❌ stock_matrix upsert エラー: {e}")
        return 0

    # ---- 在庫復活通知の送信 ----
    if stock_alerts:
        for pn, store_infos in stock_alerts.items():
            # 商品情報を取得
            product = product_info_map.get(pn, {})
            model_name = product.get("model_name", "不明")
            capacity = product.get("capacity", "")
            color = product.get("color", "")

            # 短縮名を生成（例: "Pro256シルバー", "ProMax512オレンジ"）
            short_model = model_name
            if "Pro Max" in model_name or "ProMax" in model_name:
                short_model = "ProMax"
            elif "Pro" in model_name:
                short_model = "Pro"

            short_cap = capacity.replace("GB", "").replace("TB", "TB")
            short_color = color
            for orig, repl in [
                ("コズミックオレンジ", "オレンジ"),
                ("ディープブルー", "ブルー"),
            ]:
                short_color = short_color.replace(orig, repl)

            full_model_name = f"{short_model}{short_cap}{short_color}"

            # 店舗ごとに通知対象を検索して送信
            for sid, sname in store_infos:
                # 店舗ID + パーツ番号で通知対象ユーザーを取得
                target_ids = get_notification_targets(supabase, pn, sid)

                if not target_ids:
                    logger.warning(
                        f"⚠️ {pn} @ {sname} の通知対象ユーザーはいません\n"
                        f"   → user_monitoring_conditions にこの商品×店舗の登録があるか確認してください"
                    )
                    continue

                logger.info(
                    f"📨 通知送信: {full_model_name} @ {sname} "
                    f"→ {len(target_ids)} 人"
                )
                send_notification(
                    model_name=full_model_name,
                    store_name=sname,
                    part_number=pn,
                    target_line_user_ids=target_ids,
                )

    return len(upsert_rows)


# ============================================================
# メインループ
# ============================================================
def get_poll_interval(supabase: Client) -> int:
    """
    DBからポーリング間隔（秒）を取得する
    取得できない場合はデフォルト値を返す
    """
    try:
        res = (
            supabase.table("worker_settings")
            .select("value")
            .eq("key", "poll_interval")
            .execute()
        )
        if res.data and len(res.data) > 0:
            interval = int(res.data[0]["value"])
            if interval < 5:
                logger.warning(f"⚠️ ポーリング間隔が短すぎます ({interval}秒)。最低5秒に制限します。")
                return 5
            return interval
    except Exception as e:
        logger.warning(f"⚠️ ポーリング間隔の取得に失敗: {e}")
    return DEFAULT_POLL_INTERVAL


def run_check_cycle(supabase: Client, proxies: dict) -> None:
    """1回分のチェックサイクルを実行する（proxiesは必須）"""
    global is_first_cycle

    # 0. プロキシIPを確認（ローテーション確認用）
    verify_proxy_ip(proxies)

    # 1. アクティブなエリアを取得
    try:
        areas_res = (
            supabase.table("watch_areas")
            .select("*")
            .eq("is_active", True)
            .execute()
        )
        areas = areas_res.data or []
    except Exception as e:
        logger.error(f"❌ watch_areas 取得エラー: {e}")
        return

    if not areas:
        logger.info("ℹ️ アクティブなエリアがありません。スキップします。")
        return

    # 2. アクティブな商品を取得
    try:
        products_res = (
            supabase.table("watch_products")
            .select("part_number, model_name, capacity, color")
            .eq("is_active", True)
            .execute()
        )
        products = products_res.data or []
    except Exception as e:
        logger.error(f"❌ watch_products 取得エラー: {e}")
        return

    if not products:
        logger.info("ℹ️ アクティブな商品がありません。スキップします。")
        return

    part_numbers = [p["part_number"] for p in products]
    # パーツ番号 → 商品情報のマップ（通知メッセージ生成用）
    product_info_map = {p["part_number"]: p for p in products}
    logger.info(f"🔍 監視対象: {len(areas)} エリア × {len(part_numbers)} 商品（バッチサイズ: {BATCH_SIZE}）")

    # 3. エリアごとにApple APIに問い合わせ（バッチ分割）
    total_upserted = 0
    for area in areas:
        area_name = area.get("name", "不明")
        postal_code = area.get("postal_code", "")
        area_stores = area.get("stores", [])

        if not postal_code or not area_stores:
            logger.warning(f"⚠️ エリア '{area_name}' の設定が不完全です。スキップします。")
            continue

        logger.info(f"📍 エリア '{area_name}' (〒{postal_code}) のチェック開始...")

        # パーツ番号をバッチに分割してリクエスト
        batches = [
            part_numbers[i:i + BATCH_SIZE]
            for i in range(0, len(part_numbers), BATCH_SIZE)
        ]
        logger.info(f"  📦 {len(batches)} バッチに分割してリクエスト")

        for batch_idx, batch in enumerate(batches):
            logger.info(f"  📨 バッチ {batch_idx + 1}/{len(batches)} ({len(batch)}パーツ)")

            # Apple APIに問い合わせ
            api_response = fetch_stock_from_apple(batch, postal_code, proxies)

            if api_response is None:
                logger.error(f"  ❌ バッチ {batch_idx + 1} のAPI取得に失敗")
                continue

            # 結果をstock_matrixにupsert（状態変化検知付き）
            upserted = parse_and_upsert(
                supabase, api_response, batch, area_stores,
                product_info_map=product_info_map,
            )
            total_upserted += upserted

            # バッチ間の待機（最後のバッチは不要）
            if batch_idx < len(batches) - 1:
                time.sleep(BATCH_DELAY)

    # 初回サイクル完了フラグ
    if is_first_cycle:
        is_first_cycle = False
        cache_size = len(last_status_cache)
        logger.info(
            f"📋 初回サイクル完了 — ステータスキャッシュに {cache_size} 件を格納"
            f"（次回から状態変化を検知します）"
        )

    logger.info(f"✅ チェックサイクル完了 (合計 {total_upserted} 件更新)")


def main():
    """メインエントリーポイント"""
    logger.info("=" * 60)
    logger.info("🍎 iPhone在庫監視ワーカー 起動")
    logger.info("=" * 60)

    # Supabaseクライアント初期化
    try:
        supabase = init_supabase()
        logger.info("✅ Supabase接続成功")
    except Exception as e:
        logger.error(f"❌ Supabase接続失敗: {e}")
        return

    # 起動時にDBから前回ステータスをキャッシュに読み込む
    # これにより再起動後も在庫変化を正しく検知できる
    cache_count = load_initial_cache(supabase)
    logger.info(f"📋 初期キャッシュ: {cache_count} 件読み込み済み")

    # Proxy設定（必須 — 自IPでのAPI呼び出しは禁止）
    try:
        proxies = get_proxies()
        logger.info("✅ SmartProxy設定完了")

        # 自IPを取得（プロキシとの比較用）
        logger.info("🔒 自IPアドレスを取得中（プロキシ検証用）...")
        direct_ip = get_direct_ip()
        if direct_ip:
            logger.info(f"🔒 自IP: {direct_ip}（このIPでApple APIを叩いてはいけません）")
        else:
            logger.warning("⚠️ 自IPの取得に失敗（プロキシ比較チェックをスキップ）")

        # プロキシ経由のIPアドレスを確認・自IPと比較
        verify_proxy_ip(proxies, direct_ip=direct_ip)
    except (ValueError, RuntimeError) as e:
        logger.critical(f"🚨 {e}")
        return

    # LINE通知設定の確認
    if NOTIFY_API_URL and NOTIFY_API_SECRET:
        logger.info("✅ LINE通知設定完了")
    else:
        logger.warning(
            "⚠️ LINE通知が未設定です（NOTIFY_API_URL, NOTIFY_API_SECRET）\n"
            "   在庫変化の検知は行いますが、通知は送信されません。"
        )

    logger.info(f"⏱️ デフォルトチェック間隔: {DEFAULT_POLL_INTERVAL}秒（管理画面から変更可能）")
    logger.info("=" * 60)

    # メインループ
    while True:
        try:
            cycle_start = time.time()
            run_check_cycle(supabase, proxies)
            elapsed = time.time() - cycle_start
            logger.info(f"⏱️ サイクル実行時間: {elapsed:.1f}秒")

        except KeyboardInterrupt:
            logger.info("🛑 ワーカーを停止します（Ctrl+C）")
            break
        except Exception as e:
            # 予期しないエラーでもワーカーを停止しない
            logger.error(f"❌ 予期しないエラー: {e}", exc_info=True)

        # 次のサイクルまで待機（DBから最新の間隔を取得）
        interval = get_poll_interval(supabase)
        logger.info(f"💤 {interval}秒後に次のチェックを実行...")
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            logger.info("🛑 ワーカーを停止します（Ctrl+C）")
            break


if __name__ == "__main__":
    main()
