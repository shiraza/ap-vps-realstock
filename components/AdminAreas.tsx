/**
 * 管理画面: エリア管理コンポーネント
 * watch_areas の一覧表示と is_active のトグル
 */

"use client";

import { useState } from "react";
import type { WatchArea } from "@/types/database";

interface AdminAreasProps {
  initialAreas: WatchArea[];
}

export default function AdminAreas({ initialAreas }: AdminAreasProps) {
  const [areas, setAreas] = useState<WatchArea[]>(initialAreas);
  const [loading, setLoading] = useState<number | null>(null);

  const toggleActive = async (area: WatchArea) => {
    setLoading(area.id);
    try {
      const res = await fetch("/api/admin/areas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: area.id,
          is_active: !area.is_active,
        }),
      });

      if (!res.ok) throw new Error("更新に失敗しました");

      setAreas((prev) =>
        prev.map((a) =>
          a.id === area.id ? { ...a, is_active: !a.is_active } : a
        )
      );
    } catch (err) {
      console.error("エリア更新エラー:", err);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
        📍 監視エリア
      </h2>

      {areas.length === 0 ? (
        <p className="text-gray-400 text-sm">エリアが登録されていません</p>
      ) : (
        <div className="grid gap-4">
          {areas.map((area) => (
            <div
              key={area.id}
              className={`
                rounded-xl border p-5 transition-all duration-200
                ${
                  area.is_active
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-gray-700/50 bg-gray-800/30 opacity-60"
                }
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-100 text-lg">
                    {area.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    〒{area.postal_code}
                  </p>
                </div>
                {/* トグルスイッチ */}
                <button
                  onClick={() => toggleActive(area)}
                  disabled={loading === area.id}
                  className={`
                    relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    ${area.is_active ? "bg-blue-500" : "bg-gray-600"}
                    ${loading === area.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <span
                    className={`
                      inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200
                      ${area.is_active ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>

              {/* 店舗一覧 */}
              <div className="flex flex-wrap gap-2">
                {area.stores.map((store) => (
                  <span
                    key={store.store_id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-700/40 text-xs text-gray-300"
                  >
                    🏪 {store.store_name}
                    <span className="text-gray-500">({store.store_id})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
