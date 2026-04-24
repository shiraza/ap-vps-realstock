/**
 * 在庫マトリックス表コンポーネント
 *
 * 縦軸: モデル情報（モデル名・容量・カラー）
 * 横軸: 対象店舗名
 *
 * Supabase Realtime で stock_matrix テーブルを購読し、
 * DBが更新された瞬間にリロードなしでセルが切り替わる
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { StockMatrixRow, WatchProduct } from "@/types/database";

// ============================================================
// Props
// ============================================================
interface StoreStockMatrixProps {
  /** 初期データ: stock_matrix の全行 */
  initialMatrix: StockMatrixRow[];
  /** 監視対象商品の一覧 */
  products: WatchProduct[];
}

// ============================================================
// コンポーネント
// ============================================================
export default function StoreStockMatrix({
  initialMatrix,
  products,
}: StoreStockMatrixProps) {
  const [matrix, setMatrix] = useState<StockMatrixRow[]>(initialMatrix);

  // ----------------------------------------------------------
  // Supabase Realtime 購読
  // ----------------------------------------------------------
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("stock-matrix-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_matrix" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newRow = payload.new as StockMatrixRow;
            setMatrix((prev) => {
              // 既存のエントリを更新、なければ追加
              const idx = prev.findIndex(
                (r) =>
                  r.part_number === newRow.part_number &&
                  r.store_id === newRow.store_id
              );
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newRow;
                return updated;
              }
              return [...prev, newRow];
            });
          }
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<StockMatrixRow>;
            setMatrix((prev) =>
              prev.filter(
                (r) =>
                  !(
                    r.part_number === oldRow.part_number &&
                    r.store_id === oldRow.store_id
                  )
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ----------------------------------------------------------
  // データの整理
  // ----------------------------------------------------------

  // ユニークな店舗リストを抽出（store_id順）
  const stores = useMemo(() => {
    const storeMap = new Map<string, string>();
    matrix.forEach((row) => {
      if (!storeMap.has(row.store_id)) {
        storeMap.set(row.store_id, row.store_name);
      }
    });
    return Array.from(storeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, name]) => ({ store_id: id, store_name: name }));
  }, [matrix]);

  // マトリックスデータのルックアップマップ
  const matrixMap = useMemo(() => {
    const map = new Map<string, StockMatrixRow>();
    matrix.forEach((row) => {
      map.set(`${row.part_number}__${row.store_id}`, row);
    });
    return map;
  }, [matrix]);

  // アクティブ商品のみフィルタ & モデル名→容量→カラー順でソート
  const activeProducts = useMemo(() => {
    return products
      .filter((p) => p.is_active)
      .sort((a, b) => {
        if (a.model_name !== b.model_name)
          return a.model_name.localeCompare(b.model_name);
        const capOrder = ["256GB", "512GB", "1TB", "2TB"];
        const ai = capOrder.indexOf(a.capacity);
        const bi = capOrder.indexOf(b.capacity);
        if (ai !== bi) return ai - bi;
        return a.color.localeCompare(b.color);
      });
  }, [products]);

  // 最終更新時刻
  const lastUpdated = useMemo(() => {
    if (matrix.length === 0) return null;
    const maxDate = matrix.reduce((latest, row) => {
      const d = new Date(row.updated_at);
      return d > latest ? d : latest;
    }, new Date(0));
    return maxDate;
  }, [matrix]);

  // ----------------------------------------------------------
  // レンダリング
  // ----------------------------------------------------------
  if (stores.length === 0 || activeProducts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-lg">在庫データがまだありません</p>
          <p className="text-sm mt-2">ワーカーが起動すると自動的にデータが表示されます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ヘッダー情報 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            リアルタイム更新中
          </span>
          <span className="text-sm text-gray-400">
            {activeProducts.length} モデル × {stores.length} 店舗
          </span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-500">
            最終更新: {lastUpdated.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </span>
        )}
      </div>

      {/* マトリックス表 */}
      <div className="overflow-x-auto rounded-xl border border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800/80">
              <th className="sticky left-0 z-20 bg-gray-800 px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider border-b border-r border-gray-700/50 min-w-[240px]">
                モデル
              </th>
              {stores.map((store) => (
                <th
                  key={store.store_id}
                  className="px-3 py-3 text-center text-xs font-semibold text-gray-300 border-b border-gray-700/50 min-w-[100px] whitespace-nowrap"
                >
                  {store.store_name.replace("Apple ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeProducts.map((product, rowIdx) => (
              <tr
                key={product.part_number}
                className={`
                  transition-colors hover:bg-gray-800/40
                  ${rowIdx % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"}
                `}
              >
                {/* モデル情報セル（スティッキー） */}
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 border-r border-gray-700/30">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-200 text-xs">
                      {product.model_name}
                    </span>
                    <span className="text-gray-400 text-xs mt-0.5">
                      {product.capacity} / {product.color}
                    </span>
                  </div>
                </td>
                {/* 各店舗の在庫セル */}
                {stores.map((store) => {
                  const cell = matrixMap.get(
                    `${product.part_number}__${store.store_id}`
                  );
                  const isAvailable =
                    cell?.status?.toUpperCase() === "AVAILABLE";

                  return (
                    <td
                      key={store.store_id}
                      className="px-3 py-2.5 text-center border-gray-700/20"
                    >
                      {cell ? (
                        <span
                          className={`
                            inline-flex items-center justify-center
                            w-8 h-8 rounded-full text-lg font-bold
                            transition-all duration-300
                            ${
                              isAvailable
                                ? "bg-green-500/20 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                                : "bg-gray-700/30 text-gray-500"
                            }
                          `}
                          title={`${product.model_name} ${product.capacity} ${product.color} @ ${store.store_name}: ${cell.status}`}
                        >
                          {isAvailable ? "○" : "✕"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-600 text-xs">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-6 mt-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">
            ○
          </span>
          <span>在庫あり</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-700/30 text-gray-500 text-sm font-bold">
            ✕
          </span>
          <span>在庫なし</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-600 text-sm">
            —
          </span>
          <span>データなし</span>
        </div>
      </div>
    </div>
  );
}
