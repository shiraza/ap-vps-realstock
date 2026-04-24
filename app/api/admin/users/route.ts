/**
 * LINE通知ユーザー管理 APIルート
 *
 * GET:  notification_users + user_monitoring_conditions の一覧取得
 * POST: user_monitoring_conditions の追加（upsert）
 * DELETE: user_monitoring_conditions の削除
 * PATCH: notification_users の is_active トグル
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET: 通知ユーザー一覧と監視条件を取得
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    // 通知ユーザー一覧
    const { data: users, error: usersError } = await supabase
      .from("notification_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) {
      return NextResponse.json(
        { error: usersError.message },
        { status: 500 }
      );
    }

    // 全ユーザーの監視条件
    const { data: conditions, error: conditionsError } = await supabase
      .from("user_monitoring_conditions")
      .select("*");

    if (conditionsError) {
      return NextResponse.json(
        { error: conditionsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: users || [],
      conditions: conditions || [],
    });
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

/**
 * POST: 監視条件を追加（upsert）
 * body: { user_id, part_number, area_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, part_number, area_id } = body;

    if (!user_id || !part_number || area_id === undefined) {
      return NextResponse.json(
        { error: "user_id, part_number, area_id は必須です" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("user_monitoring_conditions")
      .upsert(
        { user_id, part_number, area_id },
        { onConflict: "user_id,part_number,area_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 監視条件を削除
 * body: { user_id, part_number, area_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, part_number, area_id } = body;

    if (!user_id || !part_number || area_id === undefined) {
      return NextResponse.json(
        { error: "user_id, part_number, area_id は必須です" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("user_monitoring_conditions")
      .delete()
      .eq("user_id", user_id)
      .eq("part_number", part_number)
      .eq("area_id", area_id);

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

/**
 * PATCH: 通知ユーザーの is_active を切り替え
 * body: { id, is_active }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || is_active === undefined) {
      return NextResponse.json(
        { error: "id と is_active が必要です" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("notification_users")
      .update({ is_active })
      .eq("id", id);

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
