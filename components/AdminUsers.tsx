/**
 * 管理画面: LINE通知ユーザー管理コンポーネント
 *
 * - notification_users の一覧表示（有効/無効トグル付き）
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
} from "@/types/database";

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

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          💬 LINE通知ユーザー
        </h2>
        <span className="text-sm text-gray-400">
          {activeUsers} / {users.length} 人アクティブ
        </span>
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
                    {/* LINEアイコン */}
                    <div
                      className={`
                      flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg
                      ${user.is_active ? "bg-emerald-500/20" : "bg-gray-700/40"}
                    `}
                    >
                      💬
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 text-sm truncate">
                        {shortUserId(user.line_user_id)}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
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

                {/* 監視条件パネル（展開時） */}
                {isExpanded && (
                  <div className="border-t border-gray-700/40 p-4">
                    {allStores.length === 0 || products.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        店舗または商品が登録されていません
                      </p>
                    ) : (
                      <div className="space-y-5">
                        {allStores.map((store) => (
                          <div key={store.store_id}>
                            {/* 店舗ヘッダー */}
                            <div className="flex items-center gap-2 mb-2">
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
                                const isLoading =
                                  loadingConditions.has(condKey);

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
                                      <p className="text-xs text-gray-200 truncate">
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
