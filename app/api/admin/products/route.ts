/**
 * 商品管理 APIルート
 * PATCH: is_active の切り替え
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { part_number, is_active } = body;

    if (!part_number || is_active === undefined) {
      return NextResponse.json(
        { error: "part_number と is_active が必要です" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("watch_products")
      .update({ is_active })
      .eq("part_number", part_number);

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
