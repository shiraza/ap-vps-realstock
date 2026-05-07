/**
 * 管理画面: 配信スケジュールコンポーネント
 * 曜日×時間帯のグリッドUIでポーリングスケジュールを設定
 */

"use client";

import { useState, useCallback, useRef } from "react";

/** 曜日の定義 */
const DAYS = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

/** 時間帯（0〜23） */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** スケジュールデータの型 */
interface ScheduleData {
  enabled: boolean;
  schedule: Record<DayKey, number[]>;
}

interface AdminPollScheduleProps {
  initialSchedule: ScheduleData;
}

/** デフォルトスケジュール（全曜日 8:00〜20:00） */
const DEFAULT_SCHEDULE: ScheduleData = {
  enabled: false,
  schedule: {
    mon: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    tue: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    wed: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    thu: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    fri: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    sat: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    sun: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
};

/** 時間帯の配列からサマリーテキストを生成（例: 08:00〜21:00） */
function formatTimeRange(hours: number[]): string {
  if (hours.length === 0) return "停止";
  if (hours.length === 24) return "一日中";

  const sorted = [...hours].sort((a, b) => a - b);

  // 連続する範囲をグループ化
  const ranges: [number, number][] = [];
  let rangeStart = sorted[0];
  let rangePrev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangePrev + 1) {
      rangePrev = sorted[i];
    } else {
      ranges.push([rangeStart, rangePrev + 1]);
      rangeStart = sorted[i];
      rangePrev = sorted[i];
    }
  }
  ranges.push([rangeStart, rangePrev + 1]);

  return ranges
    .map(
      ([s, e]) =>
        `${String(s).padStart(2, "0")}:00〜${String(e === 24 ? 0 : e).padStart(2, "0")}:00`
    )
    .join(", ");
}

export default function AdminPollSchedule({
  initialSchedule,
}: AdminPollScheduleProps) {
  const [scheduleData, setScheduleData] = useState<ScheduleData>(
    initialSchedule || DEFAULT_SCHEDULE
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ドラッグ選択の状態管理
  const [isDragging, setIsDragging] = useState(false);
  const dragModeRef = useRef<"add" | "remove">("add");
  const dragStartRef = useRef<{ day: DayKey; hour: number } | null>(null);
  const dragCurrentRef = useRef<{ day: DayKey; hour: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<Set<string>>(new Set());

  /** セルの選択状態を確認 */
  const isCellActive = useCallback(
    (day: DayKey, hour: number) => {
      return scheduleData.schedule[day]?.includes(hour) ?? false;
    },
    [scheduleData]
  );

  /** ドラッグ範囲のセルをプレビュー用に計算 */
  const computeDragRange = useCallback(
    (
      start: { day: DayKey; hour: number },
      current: { day: DayKey; hour: number }
    ) => {
      const dayIndices = DAYS.map((d) => d.key);
      const startDayIdx = dayIndices.indexOf(start.day);
      const currentDayIdx = dayIndices.indexOf(current.day);
      const minDay = Math.min(startDayIdx, currentDayIdx);
      const maxDay = Math.max(startDayIdx, currentDayIdx);
      const minHour = Math.min(start.hour, current.hour);
      const maxHour = Math.max(start.hour, current.hour);

      const cells = new Set<string>();
      for (let d = minDay; d <= maxDay; d++) {
        for (let h = minHour; h <= maxHour; h++) {
          cells.add(`${dayIndices[d]}-${h}`);
        }
      }
      return cells;
    },
    []
  );

  /** ドラッグ開始 */
  const handleMouseDown = useCallback(
    (day: DayKey, hour: number) => {
      const isActive = isCellActive(day, hour);
      dragModeRef.current = isActive ? "remove" : "add";
      dragStartRef.current = { day, hour };
      dragCurrentRef.current = { day, hour };
      setIsDragging(true);
      setDragPreview(new Set([`${day}-${hour}`]));
    },
    [isCellActive]
  );

  /** ドラッグ中 */
  const handleMouseEnter = useCallback(
    (day: DayKey, hour: number) => {
      if (!isDragging || !dragStartRef.current) return;
      dragCurrentRef.current = { day, hour };
      const cells = computeDragRange(dragStartRef.current, { day, hour });
      setDragPreview(cells);
    },
    [isDragging, computeDragRange]
  );

  /** ドラッグ終了 — スケジュールを更新 */
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStartRef.current || !dragCurrentRef.current) {
      setIsDragging(false);
      setDragPreview(new Set());
      return;
    }

    const cells = computeDragRange(
      dragStartRef.current,
      dragCurrentRef.current
    );
    const mode = dragModeRef.current;

    setScheduleData((prev) => {
      const newSchedule = { ...prev.schedule };
      for (const day of DAYS) {
        const dayHours = new Set(newSchedule[day.key]);
        for (const cell of cells) {
          const [cellDay, cellHour] = cell.split("-");
          if (cellDay === day.key) {
            if (mode === "add") {
              dayHours.add(Number(cellHour));
            } else {
              dayHours.delete(Number(cellHour));
            }
          }
        }
        newSchedule[day.key] = Array.from(dayHours).sort((a, b) => a - b);
      }
      return { ...prev, schedule: newSchedule };
    });

    setIsDragging(false);
    setDragPreview(new Set());
    dragStartRef.current = null;
    dragCurrentRef.current = null;
  }, [isDragging, computeDragRange]);

  /** スケジュール機能のON/OFF切り替え */
  const handleToggleEnabled = useCallback(() => {
    setScheduleData((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  /** すべてクリア */
  const handleClearAll = useCallback(() => {
    setScheduleData((prev) => ({
      ...prev,
      schedule: {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    }));
  }, []);

  /** すべて選択 */
  const handleSelectAll = useCallback(() => {
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    setScheduleData((prev) => ({
      ...prev,
      schedule: {
        mon: [...allHours],
        tue: [...allHours],
        wed: [...allHours],
        thu: [...allHours],
        fri: [...allHours],
        sat: [...allHours],
        sun: [...allHours],
      },
    }));
  }, []);

  /** 行ごとに全時間帯をON/OFF切り替え */
  const handleToggleRow = useCallback((day: DayKey) => {
    setScheduleData((prev) => {
      const currentHours = prev.schedule[day];
      const allHours = Array.from({ length: 24 }, (_, i) => i);
      const newHours = currentHours.length === 24 ? [] : allHours;
      return {
        ...prev,
        schedule: { ...prev.schedule, [day]: newHours },
      };
    });
  }, []);

  /** 保存 */
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "poll_schedule",
          value: JSON.stringify(scheduleData),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "更新に失敗しました");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("スケジュール保存エラー:", err);
      alert("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  /** セルのスタイルを判定 */
  const getCellStyle = (day: DayKey, hour: number): string => {
    const cellKey = `${day}-${hour}`;
    const isActive = isCellActive(day, hour);
    const isInPreview = dragPreview.has(cellKey);
    const mode = dragModeRef.current;

    if (isDragging && isInPreview) {
      // ドラッグ中のプレビュー
      if (mode === "add") {
        return "bg-emerald-400/70 border-emerald-300/50";
      } else {
        return "bg-red-400/30 border-red-400/30";
      }
    }

    if (isActive) {
      return "bg-emerald-500/60 border-emerald-400/20 hover:bg-emerald-400/70";
    }

    return "bg-gray-800/40 border-gray-700/30 hover:bg-gray-700/50";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
        📅 配信スケジュール
      </h2>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
        {/* ヘッダー: 有効/無効スイッチ */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-200">
              ポーリング配信スケジュール
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              曜日と時間帯を選択して、ポーリングを実行する時間帯を設定します（日本時間
              JST）
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30 animate-pulse">
                ✅ 保存しました
              </span>
            )}
            <button
              onClick={handleToggleEnabled}
              className={`
                relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
                ${
                  scheduleData.enabled
                    ? "bg-emerald-500 focus:ring-emerald-500"
                    : "bg-gray-600 focus:ring-gray-500"
                }
              `}
            >
              <span
                className={`
                  inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300
                  ${scheduleData.enabled ? "translate-x-8" : "translate-x-1"}
                `}
              />
            </button>
            <span
              className={`text-sm font-medium ${scheduleData.enabled ? "text-emerald-400" : "text-gray-500"}`}
            >
              {scheduleData.enabled ? "有効" : "無効"}
            </span>
          </div>
        </div>

        {/* メインコンテンツ: グリッド */}
        <div
          className={`transition-opacity duration-300 ${scheduleData.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}
        >
          {/* 操作ボタン */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handleSelectAll}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
            >
              すべて選択
            </button>
            <button
              onClick={handleClearAll}
              className="text-xs px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors"
            >
              すべてクリア
            </button>
          </div>

          {/* 時間帯ヘッダー */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* 上部ラベル（00:00 - 12:00 / 12:00 - 24:00） */}
              <div className="flex items-end mb-1 pl-12">
                <div className="flex-1 text-center text-xs text-gray-500 border-b border-gray-700/30 pb-1">
                  00:00 — 12:00
                </div>
                <div className="flex-1 text-center text-xs text-gray-500 border-b border-gray-700/30 pb-1">
                  12:00 — 24:00
                </div>
              </div>

              {/* 時間数字 */}
              <div className="flex items-center mb-1 pl-12">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 text-center text-[10px] text-gray-500 select-none"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* グリッド本体 */}
              <div
                onMouseLeave={() => {
                  if (isDragging) handleMouseUp();
                }}
                onMouseUp={handleMouseUp}
                className="select-none"
              >
                {DAYS.map((day) => (
                  <div key={day.key} className="flex items-center mb-[2px]">
                    {/* 曜日ラベル（クリックで行全体をトグル） */}
                    <button
                      onClick={() => handleToggleRow(day.key)}
                      className={`
                        w-12 text-sm font-medium text-right pr-3 shrink-0 py-1 rounded-l
                        transition-colors cursor-pointer hover:text-emerald-400
                        ${day.key === "sat" ? "text-blue-400" : day.key === "sun" ? "text-red-400" : "text-gray-300"}
                      `}
                      title={`${day.label}曜日を全選択/全解除`}
                    >
                      {day.label}
                    </button>

                    {/* 時間帯セル */}
                    <div className="flex flex-1 gap-[1px]">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleMouseDown(day.key, hour);
                          }}
                          onMouseEnter={() =>
                            handleMouseEnter(day.key, hour)
                          }
                          className={`
                            flex-1 h-6 rounded-sm border cursor-pointer transition-colors duration-100
                            ${getCellStyle(day.key, hour)}
                          `}
                          title={`${day.label} ${String(hour).padStart(2, "0")}:00〜${String(hour + 1 === 24 ? 0 : hour + 1).padStart(2, "0")}:00`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 選択サマリー */}
          <div className="mt-5 border-t border-gray-700/30 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-400">
                選択された時間帯
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {DAYS.map((day) => (
                <div key={day.key} className="flex items-center gap-2 text-xs">
                  <span
                    className={`
                      w-6 text-right font-medium
                      ${day.key === "sat" ? "text-blue-400" : day.key === "sun" ? "text-red-400" : "text-gray-400"}
                    `}
                  >
                    {day.label}
                  </span>
                  <span className="text-gray-300">
                    {formatTimeRange(scheduleData.schedule[day.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-700/30 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500/50
              ${
                saving
                  ? "bg-blue-500/40 text-blue-200 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-500/25 cursor-pointer"
              }
            `}
          >
            {saving ? "保存中..." : "💾 スケジュールを保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
