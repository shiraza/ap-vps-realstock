/**
 * 通知スケジュール グリッドコンポーネント
 *
 * AdminPollSchedule と同じ曜日×時間帯UIを
 * ユーザーカード内に埋め込める汎用コンポーネントとして提供する。
 *
 * - ドラッグ選択対応
 * - 有効/無効スイッチ付き
 * - 保存ボタン付き
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type { DayKey, NotifySchedule } from "@/types/database";

/** 曜日の定義 */
const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "月" },
  { key: "tue", label: "火" },
  { key: "wed", label: "水" },
  { key: "thu", label: "木" },
  { key: "fri", label: "金" },
  { key: "sat", label: "土" },
  { key: "sun", label: "日" },
];

/** 時間帯（0〜23） */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** デフォルトスケジュール（全曜日 8:00〜21:00） */
export const DEFAULT_NOTIFY_SCHEDULE: NotifySchedule = {
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
  if (hours.length === 24) return "終日";

  const sorted = [...hours].sort((a, b) => a - b);
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
        `${String(s).padStart(2, "0")}〜${String(e === 24 ? 0 : e).padStart(2, "0")}時`
    )
    .join(", ");
}

interface NotifyScheduleGridProps {
  /** 初期スケジュール（DBから取得した値） */
  initialSchedule: NotifySchedule | null;
  /** 保存ボタン押下時のコールバック */
  onSave: (schedule: NotifySchedule) => Promise<void>;
  /** 保存中フラグ */
  saving?: boolean;
}

export default function NotifyScheduleGrid({
  initialSchedule,
  onSave,
  saving = false,
}: NotifyScheduleGridProps) {
  const [scheduleData, setScheduleData] = useState<NotifySchedule>(() => {
    // initialSchedule が schedule キーを持たない場合も考慮してディープマージ
    const base = initialSchedule ?? DEFAULT_NOTIFY_SCHEDULE;
    return {
      ...DEFAULT_NOTIFY_SCHEDULE,
      ...base,
      schedule: {
        ...DEFAULT_NOTIFY_SCHEDULE.schedule,
        ...(base.schedule ?? {}),
      },
    };
  });
  const [isDirty, setIsDirty] = useState(false);

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

    const cells = computeDragRange(dragStartRef.current, dragCurrentRef.current);
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
    setIsDirty(true);

    setIsDragging(false);
    setDragPreview(new Set());
    dragStartRef.current = null;
    dragCurrentRef.current = null;
  }, [isDragging, computeDragRange]);

  /** 有効/無効スイッチ切り替え */
  const handleToggleEnabled = useCallback(() => {
    setScheduleData((prev) => ({ ...prev, enabled: !prev.enabled }));
    setIsDirty(true);
  }, []);

  /** すべてクリア */
  const handleClearAll = useCallback(() => {
    setScheduleData((prev) => ({
      ...prev,
      schedule: {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
      },
    }));
    setIsDirty(true);
  }, []);

  /** すべて選択 */
  const handleSelectAll = useCallback(() => {
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    setScheduleData((prev) => ({
      ...prev,
      schedule: {
        mon: [...allHours], tue: [...allHours], wed: [...allHours],
        thu: [...allHours], fri: [...allHours], sat: [...allHours],
        sun: [...allHours],
      },
    }));
    setIsDirty(true);
  }, []);

  /** 行ごとに全時間帯をON/OFF切り替え */
  const handleToggleRow = useCallback((day: DayKey) => {
    setScheduleData((prev) => {
      const currentHours = prev.schedule[day];
      const allHours = Array.from({ length: 24 }, (_, i) => i);
      const newHours = currentHours.length === 24 ? [] : allHours;
      return { ...prev, schedule: { ...prev.schedule, [day]: newHours } };
    });
    setIsDirty(true);
  }, []);

  /** セルのスタイルを判定 */
  const getCellStyle = (day: DayKey, hour: number): string => {
    const cellKey = `${day}-${hour}`;
    const isActive = isCellActive(day, hour);
    const isInPreview = dragPreview.has(cellKey);
    const mode = dragModeRef.current;

    if (isDragging && isInPreview) {
      return mode === "add"
        ? "bg-amber-400/70 border-amber-300/50"
        : "bg-red-400/30 border-red-400/30";
    }
    if (isActive) {
      return "bg-amber-500/60 border-amber-400/20 hover:bg-amber-400/70";
    }
    return "bg-gray-800/40 border-gray-700/30 hover:bg-gray-700/50";
  };

  /** 保存 */
  const handleSave = async () => {
    await onSave(scheduleData);
    setIsDirty(false);
  };

  /** スケジュールが有効だが時間帯が1つも選ばれていないか */
  const isEnabledButEmpty =
    scheduleData.enabled &&
    Object.values(scheduleData.schedule).every((hours) => hours.length === 0);

  return (
    <div className="space-y-3">
      {/* ヘッダー: 有効/無効スイッチ */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">📅 通知を受け取る時間帯</span>
        <button
          onClick={handleToggleEnabled}
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
            focus:outline-none cursor-pointer
            ${scheduleData.enabled ? "bg-amber-500" : "bg-gray-600"}
          `}
          title={scheduleData.enabled ? "時間帯指定を無効にする（常時通知）" : "時間帯指定を有効にする"}
        >
          <span
            className={`
              inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200
              ${scheduleData.enabled ? "translate-x-[18px]" : "translate-x-0.5"}
            `}
          />
        </button>
        <span className={`text-xs font-medium ${scheduleData.enabled ? "text-amber-400" : "text-gray-500"}`}>
          {scheduleData.enabled ? "有効（選んだ時間帯のみ通知）" : "無効（常時通知）"}
        </span>
      </div>

      {/* グリッドエリア */}
      <div className={`transition-opacity duration-300 ${scheduleData.enabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
        {/* 説明テキスト */}
        <p className="text-[11px] text-gray-500 mb-2">
          🟡 色がついているマスの時間帯に通知が届きます
        </p>

        {/* 警告: 有効なのに時間帯が0件 */}
        {isEnabledButEmpty && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] font-medium">
            ⚠️ 時間帯が1つも選ばれていません。このままでは通知が一切届きません。<br />
            時間帯を選択するか、スイッチをOFFにして常時通知にしてください。
          </div>
        )}
        {/* 操作ボタン */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleSelectAll}
            className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-colors"
          >
            すべて選択
          </button>
          <button
            onClick={handleClearAll}
            className="text-xs px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors"
          >
            すべてクリア
          </button>
        </div>

        {/* グリッド本体（スクロール対応） */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* 午前/午後ラベル */}
            <div className="flex items-end mb-0.5 pl-8">
              <div className="flex-1 text-center text-[10px] text-gray-600 border-b border-gray-700/30 pb-0.5">
                00:00 — 12:00
              </div>
              <div className="flex-1 text-center text-[10px] text-gray-600 border-b border-gray-700/30 pb-0.5">
                12:00 — 24:00
              </div>
            </div>

            {/* 時間数字 */}
            <div className="flex items-center mb-0.5 pl-8">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[9px] text-gray-600 select-none"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* グリッド本体 */}
            <div
              onMouseLeave={() => { if (isDragging) handleMouseUp(); }}
              onMouseUp={handleMouseUp}
              className="select-none"
            >
              {DAYS.map((day) => (
                <div key={day.key} className="flex items-center mb-[2px]">
                  {/* 曜日ラベル */}
                  <button
                    onClick={() => handleToggleRow(day.key)}
                    className={`
                      w-8 text-xs font-medium text-right pr-2 shrink-0 py-0.5 rounded-l
                      transition-colors cursor-pointer hover:text-amber-400
                      ${day.key === "sat" ? "text-blue-400" : day.key === "sun" ? "text-red-400" : "text-gray-400"}
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
                        onMouseEnter={() => handleMouseEnter(day.key, hour)}
                        className={`
                          flex-1 h-5 rounded-sm border cursor-pointer transition-colors duration-100
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

        {/* サマリー（選択中の時間帯） */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
          {DAYS.map((day) => (
            <div key={day.key} className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`
                  w-4 text-right font-medium shrink-0
                  ${day.key === "sat" ? "text-blue-400" : day.key === "sun" ? "text-red-400" : "text-gray-500"}
                `}
              >
                {day.label}
              </span>
              <span className="text-gray-400 truncate">
                {formatTimeRange(scheduleData.schedule[day.key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 保存ボタン（変更がある場合のみ表示） */}
      {isDirty && (
        <div className="flex justify-end pt-1">
          {isEnabledButEmpty && (
            <span className="text-[11px] text-red-400 mr-3 self-center">
              時間帯を選択してから保存してください
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || isEnabledButEmpty}
            className={`
              text-xs px-4 py-1.5 rounded-lg transition-colors
              ${
                saving || isEnabledButEmpty
                  ? "bg-gray-600/50 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500/80 hover:bg-blue-400 text-white cursor-pointer"
              }
            `}
          >
            {saving ? "保存中..." : "💾 保存"}
          </button>
        </div>
      )}
    </div>
  );
}
