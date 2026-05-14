/**
 * 管理画面: LINE通知ユーザー管理コンポーネント
 *
 * - notification_users の一覧表示（有効/無効トグル付き）
 * - 各ユーザーの通知曜日制限の設定
 * - 各ユーザーの監視条件（店舗×商品）をチェックボックスで設定
 * - user_monitoring_conditions の追加/削除をAPI経由で即時反映
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  WatchArea,
  WatchProduct,
  NotificationUser,
  UserMonitoringCondition,
  DayKey,
  NotifyDays,
} from "@/types/database";

/** 曜日の定義 */
const DAYS: { key: DayKey; label: string; color: string }[] = [
  { key: "mon", label: "月", color: "text-gray-300" },
  { key: "tue", label: "火", color: "text-gray-300" },
  { key: "wed", label: "水", color: "text-gray-300" },
  { key: "thu", label: "木", color: "text-gray-300" },
  { key: "fri", label: "金", color: "text-gray-300" },
  { key: "sat", label: "土", color: "text-blue-400" },
  { key: "sun", label: "日", color: "text-red-400" },
];

/** 店舗情報（エリアから展開したフラット構造） */
interface FlatStore {
  store_id: string;
  store_name: string;
  area_name: string;
  postal_code: string;
  area_is_active: boolean;
}

interface AdminUsersProps {
  initialUsers: NotificationUser[];
  initialConditions: UserMonitoringCondition[];
  areas: WatchArea[];
  products: WatchProduct[];
}

export default function AdminUsers({
  initialUsers,
  initialConditions,
  areas,
  products,
}: AdminUsersProps) {
  const [users, setUsers] = useState<NotificationUser[]>(initialUsers);
  const [conditions, setConditions] =
    useState<UserMonitoringCondition[]>(initialConditions);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  // 処理中のチェックボックスを追跡（"userId:partNumber:storeId" 形式）
  const [loadingConditions, setLoadingConditions] = useState<Set<string>>(
    new Set()
  );
  // 展開中のユーザーID
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  // 曜日設定の保存中ユーザーID
  const [savingDaysUserId, setSavingDaysUserId] = useState<string | null>(null);
  // 編集中の notify_days（ユーザーIDをキーとしたローカルステート）
  const [editingDays, setEditingDays] = useState<Record<string, NotifyDays>>({});

  /**
   * 全エリアの店舗をフラットなリストに展開
   * 例: 関東エリア → Apple 銀座, Apple 新宿, ...
   */
  const allStores: FlatStore[] = useMemo(() => {
    const stores: FlatStore[] = [];
    for (const area of areas) {
      for (const store of area.stores) {
        stores.push({
          store_id: store.store_id,
          store_name: store.store_name,
          area_name: area.name,
          postal_code: area.postal_code,
          area_is_active: area.is_active,
        });
      }
    }
    return stores;
  }, [areas]);

  /**
   * ユーザーの is_active を切り替え
   */
  const toggleUserActive = async (user: NotificationUser) => {
    setLoadingUserId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          is_active: !user.is_active,
        }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        )
      );
    } catch (err) {
      console.error("ユーザー更新エラー:", err);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setLoadingUserId(null);
    }
  };

  /**
   * 編集中の notify_days を取得（ローカルステートを優先、なければDBの値を使用）
   */
  const getEditingDays = useCallback(
    (user: NotificationUser): NotifyDays => {
      if (editingDays[user.id]) return editingDays[user.id];
      // DBの値があればそれを使用、なければデフォルト（全曜日OFF）
      return (
        user.notify_days ?? {
          enabled: false,
          days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        }
      );
    },
    [editingDays]
  );

  /**
   * 曜日設定の有効/無効スイッチを切り替え
   */
  const toggleDaysEnabled = useCallback((user: NotificationUser) => {
    setEditingDays((prev) => {
      const current = prev[user.id] ??
        user.notify_days ??
        { enabled: false, days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] };
      return {
        ...prev,
        [user.id]: { ...current, enabled: !current.enabled },
      };
    });
  }, []);

  /**
   * 曜日ボタンをトグル
   */
  const toggleDay = useCallback((user: NotificationUser, day: DayKey) => {
    setEditingDays((prev) => {
      const current = prev[user.id] ??
        user.notify_days ??
        { enabled: false, days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] };
      const days = current.days.includes(day)
        ? current.days.filter((d) => d !== day)
        : [...current.days, day];
      return {
        ...prev,
        [user.id]: { ...current, days },
      };
    });
  }, []);

  /**
   * 曜日設定を保存
   */
  const saveNotifyDays = async (user: NotificationUser) => {
    const notifyDays = getEditingDays(user);
    setSavingDaysUserId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          notify_days: notifyDays,
        }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");

      // ローカルステートのユーザー情報も更新
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, notify_days: notifyDays } : u
        )
      );
      // 編集ステートをクリア
      setEditingDays((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      console.error("曜日設定保存エラー:", err);
      alert("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSavingDaysUserId(null);
    }
  };

  /**
   * 監視条件が存在するかチェック
   */
  const hasCondition = useCallback(
    (userId: string, partNumber: string, storeId: string) => {
      return conditions.some(
        (c) =>
          c.user_id === userId &&
          c.part_number === partNumber &&
          c.store_id === storeId
      );
    },
    [conditions]
  );

  /**
   * 監視条件のトグル（追加 or 削除）
   */
  const toggleCondition = async (
    userId: string,
    partNumber: string,
    storeId: string
  ) => {
    const condKey = `${userId}:${partNumber}:${storeId}`;
    setLoadingConditions((prev) => new Set(prev).add(condKey));

    const exists = hasCondition(userId, partNumber, storeId);

    try {
      const res = await fetch("/api/admin/users", {
        method: exists ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          part_number: partNumber,
          store_id: storeId,
        }),
      });

      if (!res.ok) throw new Error("更新に失敗しました");

      if (exists) {
        // 条件を削除
        setConditions((prev) =>
          prev.filter(
            (c) =>
              !(
                c.user_id === userId &&
                c.part_number === partNumber &&
                c.store_id === storeId
              )
          )
        );
      } else {
        // 条件を追加
        const result = await res.json();
        const newCondition: UserMonitoringCondition = result.data || {
          id: crypto.randomUUID(),
          user_id: userId,
          part_number: partNumber,
          store_id: storeId,
          created_at: new Date().toISOString(),
        };
        setConditions((prev) => [...prev, newCondition]);
      }
    } catch (err) {
      console.error("監視条件更新エラー:", err);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setLoadingConditions((prev) => {
        const next = new Set(prev);
        next.delete(condKey);
        return next;
      });
    }
  };

  /**
   * 監視条件の店舗一括トグル（追加 or 削除）
   */
  const toggleStoreConditions = async (
    userId: string,
    storeId: string,
    isSelectAll: boolean
  ) => {
    const storeKey = `store:${userId}:${storeId}`;
    setLoadingConditions((prev) => new Set(prev).add(storeKey));

    const allPartNumbers = products.map((p) => p.part_number);

    try {
      const res = await fetch("/api/admin/users", {
        method: isSelectAll ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          part_numbers: allPartNumbers,
          store_id: storeId,
        }),
      });

      if (!res.ok) throw new Error("一括更新に失敗しました");

      if (!isSelectAll) {
        setConditions((prev) =>
          prev.filter((c) => !(c.user_id === userId && c.store_id === storeId))
        );
      } else {
        const result = await res.json();
        const newConditions: UserMonitoringCondition[] = result.data || [];
        setConditions((prev) => {
          const others = prev.filter(
            (c) => !(c.user_id === userId && c.store_id === storeId)
          );
          return [...others, ...newConditions];
        });
      }
    } catch (err) {
      console.error("監視条件一括更新エラー:", err);
      alert("一括更新に失敗しました。もう一度お試しください。");
    } finally {
      setLoadingConditions((prev) => {
        const next = new Set(prev);
        next.delete(storeKey);
        return next;
      });
    }
  };

  /**
   * ユーザーの監視条件数を取得
   */
  const getConditionCount = (userId: string) => {
    return conditions.filter((c) => c.user_id === userId).length;
  };

  /**
   * LINE ユーザーIDの短縮表示
   */
  const shortUserId = (lineUserId: string) => {
    if (lineUserId.length <= 12) return lineUserId;
    return `${lineUserId.slice(0, 6)}...${lineUserId.slice(-4)}`;
  };

  const activeUsers = users.filter((u) => u.is_active).length;
  const [syncing, setSyncing] = useState(false);

  /**
   * 全ユーザーのプロフィールをLINE APIから一括取得して更新
   */
  const syncProfiles = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/users/sync-profiles", {
        method: "POST",
      });
      if (!res.ok) throw new Error("プロフィール取得に失敗しました");
      const result = await res.json();
      alert(
        `プロフィール更新完了\n更新: ${result.updated}件 / 失敗: ${result.failed}件`
      );
      // ページをリロードして最新データを反映
      window.location.reload();
    } catch (err) {
      console.error("プロフィール同期エラー:", err);
      alert("プロフィール取得に失敗しました。LINE_CHANNEL_ACCESS_TOKEN を確認してください。");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          💬 LINE通知ユーザー
        </h2>
        <div className="flex items-center gap-3">
          {users.length > 0 && (
            <button
              onClick={syncProfiles}
              disabled={syncing}
              className={`
                text-xs px-3 py-1.5 rounded-lg transition-colors
                bg-gray-700/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200
                ${syncing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {syncing ? "⏳ 取得中..." : "🔄 プロフィール更新"}
            </button>
          )}
          <span className="text-sm text-gray-400">
            {activeUsers} / {users.length} 人アクティブ
          </span>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-8 text-center">
          <p className="text-gray-400 text-sm">
            LINEボットを友だち追加したユーザーがいません
          </p>
          <p className="text-gray-500 text-xs mt-2">
            ユーザーがLINEボットを友だち追加すると、ここに表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const isExpanded = expandedUserId === user.id;
            const condCount = getConditionCount(user.id);

            return (
              <div
                key={user.id}
                className={`
                  rounded-xl border transition-all duration-200
                  ${
                    user.is_active
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-gray-700/50 bg-gray-800/30 opacity-60"
                  }
                `}
              >
                {/* ユーザー情報ヘッダー */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* プロフィール画像 */}
                    {user.picture_url ? (
                      <img
                        src={user.picture_url}
                        alt={user.display_name || "LINE"}
                        className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`
                        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg
                        ${user.is_active ? "bg-emerald-500/20" : "bg-gray-700/40"}
                      `}
                      >
                        💬
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 text-sm truncate">
                        {user.display_name || shortUserId(user.line_user_id)}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {user.display_name && (
                          <span className="text-[10px] text-gray-600 font-mono truncate max-w-[100px]">
                            {shortUserId(user.line_user_id)}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          登録:{" "}
                          {new Date(user.created_at).toLocaleDateString("ja-JP")}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            condCount > 0
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-gray-700/40 text-gray-500"
                          }`}
                        >
                          条件: {condCount}件
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* 展開/折りたたみボタン */}
                    <button
                      onClick={() =>
                        setExpandedUserId(isExpanded ? null : user.id)
                      }
                      className="text-xs text-gray-400 hover:text-gray-200 
                        px-3 py-1.5 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 
                        transition-colors cursor-pointer"
                    >
                      {isExpanded ? "▲ 閉じる" : "▼ 条件設定"}
                    </button>

                    {/* トグルスイッチ */}
                    <button
                      onClick={() => toggleUserActive(user)}
                      disabled={loadingUserId === user.id}
                      className={`
                        relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                        ${user.is_active ? "bg-emerald-500" : "bg-gray-600"}
                        ${loadingUserId === user.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
                          ${user.is_active ? "translate-x-5" : "translate-x-1"}
                        `}
                      />
                    </button>
                  </div>
                </div>

                {/* 曜日通知制限パネル */}
                {isExpanded && (() => {
                  const notifyDays = getEditingDays(user);
                  const isDirty =
                    JSON.stringify(editingDays[user.id]) !==
                    JSON.stringify(user.notify_days);
                  const isSaving = savingDaysUserId === user.id;

                  return (
                    <div className="border-t border-gray-700/40 px-4 py-3 bg-gray-900/20">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* 有効/無効ラベル＋スイッチ */}
                        <span className="text-xs text-gray-400 font-medium">📅 曜日制限</span>
                        <button
                          onClick={() => toggleDaysEnabled(user)}
                          className={`
                            relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
                            focus:outline-none
                            ${notifyDays.enabled ? "bg-amber-500" : "bg-gray-600"}
                            cursor-pointer
                          `}
                          title={notifyDays.enabled ? "曜日制限を無効にする" : "曜日制限を有効にする"}
                        >
                          <span
                            className={`
                              inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200
                              ${notifyDays.enabled ? "translate-x-4.5" : "translate-x-0.5"}
                            `}
                          />
                        </button>
                        <span className={`text-xs font-medium ${
                          notifyDays.enabled ? "text-amber-400" : "text-gray-500"
                        }`}>
                          {notifyDays.enabled ? "有効" : "無効（全曜日通知）"}
                        </span>

                        {/* 曜日ボタン */}
                        <div className={`flex gap-1 ml-2 transition-opacity ${
                          notifyDays.enabled ? "opacity-100" : "opacity-30 pointer-events-none"
                        }`}>
                          {DAYS.map((d) => {
                            const isSelected = notifyDays.days.includes(d.key);
                            return (
                              <button
                                key={d.key}
                                onClick={() => toggleDay(user, d.key)}
                                title={`${d.label}曜日の通知を${isSelected ? "オフ" : "オン"}にする`}
                                className={`
                                  w-7 h-7 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer
                                  ${
                                    isSelected
                                      ? `bg-amber-500/80 border border-amber-400/60 ${d.color}`
                                      : "bg-gray-800/60 border border-gray-700/40 text-gray-600 hover:border-gray-600"
                                  }
                                `}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* 保存ボタン */}
                        {(isDirty || editingDays[user.id]) && (
                          <button
                            onClick={() => saveNotifyDays(user)}
                            disabled={isSaving}
                            className={`
                              ml-auto text-xs px-3 py-1 rounded-lg transition-colors
                              ${
                                isSaving
                                  ? "bg-blue-500/30 text-blue-300 cursor-not-allowed"
                                  : "bg-blue-500/80 hover:bg-blue-400 text-white cursor-pointer"
                              }
                            `}
                          >
                            {isSaving ? "保存中..." : "💾 保存"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 監視条件パネル（展開時） */}
                {isExpanded && (
                  <div className="border-t border-gray-700/40 p-4 pt-3">
                    {allStores.length === 0 || products.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        店舗または商品が登録されていません
                      </p>
                    ) : (
                      <div className="space-y-5">
                        {allStores.map((store) => (
                          <div key={store.store_id}>
                            {/* 店舗ヘッダー */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-300">
                                🏪 {store.store_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {store.area_name}
                              </span>
                              <span className="text-[10px] text-gray-600">
                                {store.store_id}
                              </span>
                              {!store.area_is_active && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                  エリア無効
                                </span>
                              )}
                              {/* 一括操作ボタン */}
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  onClick={() => toggleStoreConditions(user.id, store.store_id, true)}
                                  disabled={loadingConditions.has(`store:${user.id}:${store.store_id}`)}
                                  className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                >
                                  すべて選択
                                </button>
                                <button
                                  onClick={() => toggleStoreConditions(user.id, store.store_id, false)}
                                  disabled={loadingConditions.has(`store:${user.id}:${store.store_id}`)}
                                  className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors disabled:opacity-50"
                                >
                                  すべて解除
                                </button>
                              </div>
                            </div>

                            {/* 商品チェックボックス */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2">
                              {products.map((product) => {
                                const condKey = `${user.id}:${product.part_number}:${store.store_id}`;
                                const isChecked = hasCondition(
                                  user.id,
                                  product.part_number,
                                  store.store_id
                                );
                                const storeKey = `store:${user.id}:${store.store_id}`;
                                const isLoading =
                                  loadingConditions.has(condKey) || loadingConditions.has(storeKey);

                                return (
                                  <label
                                    key={condKey}
                                    className={`
                                      flex items-center gap-2.5 px-3 py-2 rounded-lg 
                                      transition-all duration-150 cursor-pointer select-none
                                      ${
                                        isChecked
                                          ? "bg-blue-500/10 border border-blue-500/30"
                                          : "bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60"
                                      }
                                      ${isLoading ? "opacity-50 pointer-events-none" : ""}
                                    `}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() =>
                                        toggleCondition(
                                          user.id,
                                          product.part_number,
                                          store.store_id
                                        )
                                      }
                                      disabled={isLoading}
                                      className="w-4 h-4 rounded border-gray-500 text-blue-500 
                                        focus:ring-blue-500/50 focus:ring-offset-0 
                                        bg-gray-700 cursor-pointer accent-blue-500"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-gray-200 truncate">
                                        {product.model_name}
                                      </p>
                                      <p className="text-[11px] text-gray-400 truncate">
                                        {product.capacity} {product.color}
                                      </p>
                                      <p className="text-[10px] text-gray-500 truncate">
                                        {product.part_number}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

