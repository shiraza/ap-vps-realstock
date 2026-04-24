"""
iPhone在庫監視 Pythonワーカー

処理フロー:
1. while True で time.sleep(20) ごとにループ実行
2. supabase-py で watch_areas と watch_products から is_active=true のデータを取得
3. watch_areas の各 postal_code ごとにループし、全 part_number をパラメータとして
   Apple Fulfillment API にGETリクエストを送信
4. 取得した各店舗・各パーツの在庫ステータスを stock_matrix テーブルに upsert

環境変数（.envから読み込み）:
  SUPABASE_URL          - SupabaseのURL
  SUPABASE_SERVICE_KEY  - SupabaseのService Role Key
  PROXY_HOST            - SmartProxyのホスト
  PROXY_PORT            - SmartProxyのポート
  PROXY_USER            - SmartProxyのユーザー名
  PROXY_PASS            - SmartProxyのパスワード
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
# Supabaseクライアント初期化
# ============================================================
def init_supabase() -> Client:
    """Supabaseクライアントを初期化する"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError(
            "SUPABASE_URL と SUPABASE_SERVICE_KEY を .env に設定してください"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


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


def verify_proxy_ip(proxies: dict) -> str | None:
    """
    プロキシ経由で現在のIPアドレスを取得・表示する
    起動時の確認用（自IPでないことを確認）
    """
    try:
        res = requests.get(
            "https://httpbin.org/ip",
            proxies=proxies,
            timeout=10,
        )
        res.raise_for_status()
        ip = res.json().get("origin", "不明")
        logger.info(f"🌐 プロキシIP確認: {ip}")
        return ip
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
    proxies: dict | None,
) -> dict | None:
    """
    Apple Fulfillment API から在庫情報を取得する

    戻り値: APIレスポンスのJSON（辞書）またはNone（エラー時）
    """
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
# 在庫データの解析とUpsert
# ============================================================
def parse_and_upsert(
    supabase: Client,
    api_response: dict,
    part_numbers: list[str],
    area_stores: list[dict],
) -> int:
    """
    Apple APIレスポンスを解析し、stock_matrixにupsertする

    Args:
        supabase: Supabaseクライアント
        api_response: Apple APIのJSONレスポンス
        part_numbers: 対象パーツ番号リスト
        area_stores: エリアの店舗リスト [{store_id, store_name}, ...]

    Returns:
        upsert件数
    """
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
        return len(upsert_rows)

    except Exception as e:
        logger.error(f"❌ stock_matrix upsert エラー: {e}")
        return 0


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


def run_check_cycle(supabase: Client, proxies: dict | None) -> None:
    """1回分のチェックサイクルを実行する"""

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
            .select("part_number")
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

            # 結果をstock_matrixにupsert
            upserted = parse_and_upsert(supabase, api_response, batch, area_stores)
            total_upserted += upserted

            # バッチ間の待機（最後のバッチは不要）
            if batch_idx < len(batches) - 1:
                time.sleep(BATCH_DELAY)

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

    # Proxy設定（必須 — 自IPでのAPI呼び出しは禁止）
    try:
        proxies = get_proxies()
        logger.info("✅ SmartProxy設定完了")
        # プロキシ経由のIPアドレスを確認・表示
        verify_proxy_ip(proxies)
    except ValueError as e:
        logger.error(str(e))
        return

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
