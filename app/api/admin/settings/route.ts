/**
 * ワーカー設定 APIルート
 * PATCH: 設定値の更新
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key と value が必要です" },
        { status: 400 }
      );
    }

    // バリデーション: poll_interval は 0（停止）または 3〜600 の整数のみ
    if (key === "poll_interval") {
      const num = parseInt(value, 10);
      if (isNaN(num) || (num !== 0 && (num < 3 || num > 600))) {
        return NextResponse.json(
          { error: "ポーリング間隔は0（停止）または3〜600秒の範囲で設定してください" },
          { status: 400 }
        );
      }
    }

    // バリデーション: poll_schedule はJSON形式で曜日×時間帯の構造
    if (key === "poll_schedule") {
      try {
        const schedule = JSON.parse(value);
        const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

        if (typeof schedule.enabled !== "boolean") {
          throw new Error("enabled は真偽値が必要です");
        }
        if (!schedule.schedule || typeof schedule.schedule !== "object") {
          throw new Error("schedule オブジェクトが必要です");
        }

        for (const day of validDays) {
          if (!Array.isArray(schedule.schedule[day])) {
            throw new Error(`${day} は配列が必要です`);
          }
          for (const hour of schedule.schedule[day]) {
            if (typeof hour !== "number" || hour < 0 || hour > 23) {
              throw new Error(`${day} の時間帯は0〜23の整数が必要です`);
            }
          }
        }
      } catch (e) {
        return NextResponse.json(
          { error: `スケジュール設定が不正です: ${e instanceof Error ? e.message : "不明なエラー"}` },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("worker_settings")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
