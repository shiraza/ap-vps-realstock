/**
 * 管理画面: ワーカー設定コンポーネント
 * ポーリング間隔の表示と変更
 */

"use client";

import { useState } from "react";

interface AdminWorkerSettingsProps {
  initialInterval: number;
}

const INTERVAL_OPTIONS = [
  { value: 0, label: "⏹ 停止" },
  { value: 10, label: "10秒" },
  { value: 15, label: "15秒" },
  { value: 20, label: "20秒" },
  { value: 30, label: "30秒（デフォルト）" },
  { value: 60, label: "1分" },
  { value: 120, label: "2分" },
  { value: 300, label: "5分" },
];

export default function AdminWorkerSettings({
  initialInterval,
}: AdminWorkerSettingsProps) {
  const [interval, setInterval] = useState(initialInterval);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = async (newValue: number) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "poll_interval",
          value: String(newValue),
        }),
      });

      if (!res.ok) throw new Error("更新に失敗しました");

      setInterval(newValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("設定更新エラー:", err);
      alert("更新に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
        ⏱️ ワーカー設定
      </h2>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-200">
              ポーリング間隔
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Apple APIへの問い合わせ間隔。変更は次のサイクルから即座に反映されます。
            </p>
          </div>
          {saved && (
            <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30 animate-pulse">
              ✅ 保存しました
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              disabled={saving}
              className={`
                px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                focus:outline-none focus:ring-2
                ${
                  opt.value === 0
                    ? interval === 0
                      ? "bg-red-600 text-white shadow-lg shadow-red-500/25 ring-red-500/50"
                      : "bg-gray-700/40 text-red-400 hover:bg-red-500/20 hover:text-red-300 focus:ring-red-500/50"
                    : interval === opt.value
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25 ring-blue-500/50"
                    : "bg-gray-700/40 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100 focus:ring-blue-500/50"
                }
                ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <span
            className={`w-2 h-2 rounded-full ${
              interval === 0 ? "bg-red-500/80" : "bg-yellow-500/60"
            }`}
          />
          <span>
            現在の設定:{" "}
            {interval === 0 ? (
              <strong className="text-red-400">停止中（ポーリングしていません）</strong>
            ) : (
              <>
                <strong className="text-gray-300">{interval}秒</strong>
                ごとにApple APIをチェック
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
