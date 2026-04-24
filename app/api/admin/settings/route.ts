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

    // バリデーション: poll_interval は 5〜600 の整数のみ
    if (key === "poll_interval") {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 5 || num > 600) {
        return NextResponse.json(
          { error: "ポーリング間隔は5〜600秒の範囲で設定してください" },
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
