/**
 * 管理画面: 商品管理コンポーネント
 * watch_products の一覧表示と is_active のトグル
 */

"use client";

import { useState, useMemo } from "react";
import type { WatchProduct } from "@/types/database";

interface AdminProductsProps {
  initialProducts: WatchProduct[];
}

/** カラーに対応する絵文字 */
function colorEmoji(color: string): string {
  if (color.includes("シルバー")) return "⚪";
  if (color.includes("ブルー")) return "🔵";
  if (color.includes("オレンジ")) return "🟠";
  return "⚫";
}

export default function AdminProducts({ initialProducts }: AdminProductsProps) {
  const [products, setProducts] = useState<WatchProduct[]>(initialProducts);
  const [loadingPn, setLoadingPn] = useState<string | null>(null);

  // モデル名でグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, WatchProduct[]>();
    const sorted = [...products].sort((a, b) => {
      if (a.model_name !== b.model_name)
        return a.model_name.localeCompare(b.model_name);
      const capOrder = ["256GB", "512GB", "1TB", "2TB"];
      return capOrder.indexOf(a.capacity) - capOrder.indexOf(b.capacity);
    });
    sorted.forEach((p) => {
      if (!map.has(p.model_name)) map.set(p.model_name, []);
      map.get(p.model_name)!.push(p);
    });
    return Array.from(map.entries());
  }, [products]);

  const toggleActive = async (product: WatchProduct) => {
    setLoadingPn(product.part_number);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_number: product.part_number,
          is_active: !product.is_active,
        }),
      });

      if (!res.ok) throw new Error("更新に失敗しました");

      setProducts((prev) =>
        prev.map((p) =>
          p.part_number === product.part_number
            ? { ...p, is_active: !p.is_active }
            : p
        )
      );
    } catch (err) {
      console.error("商品更新エラー:", err);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setLoadingPn(null);
    }
  };

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          📱 監視対象モデル
        </h2>
        <span className="text-sm text-gray-400">
          {activeCount} / {products.length} 件アクティブ
        </span>
      </div>

      {grouped.length === 0 ? (
        <p className="text-gray-400 text-sm">商品が登録されていません</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([modelName, items]) => (
            <div key={modelName}>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {modelName}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((product) => (
                  <div
                    key={product.part_number}
                    className={`
                      rounded-lg border p-3.5 transition-all duration-200 flex items-center justify-between
                      ${
                        product.is_active
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-gray-700/40 bg-gray-800/20 opacity-50"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{colorEmoji(product.color)}</span>
                      <div>
                        <p className="font-medium text-gray-200 text-sm">
                          {product.capacity} {product.color}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {product.part_number}
                        </p>
                      </div>
                    </div>
                    {/* トグルスイッチ */}
                    <button
                      onClick={() => toggleActive(product)}
                      disabled={loadingPn === product.part_number}
                      className={`
                        relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-green-500/50
                        ${product.is_active ? "bg-green-500" : "bg-gray-600"}
                        ${loadingPn === product.part_number ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
                          ${product.is_active ? "translate-x-5" : "translate-x-1"}
                        `}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
