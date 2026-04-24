/**
 * LINE通知ユーザー - プロフィール同期API
 *
 * POST: LINE Profile APIからプロフィールを一括取得して更新
 *       既存ユーザーで display_name が未取得のものを更新する
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * LINE Profile API からユーザーのプロフィールを取得する
 */
async function getLineProfile(
  userId: string,
  accessToken: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      displayName: data.displayName || "不明",
      pictureUrl: data.pictureUrl || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * POST: 全ユーザーのプロフィールを一括更新
 */
export async function POST() {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "LINE_CHANNEL_ACCESS_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const supabase = getSupabaseServer();

    // アクティブなユーザーを取得
    const { data: users, error } = await supabase
      .from("notification_users")
      .select("id, line_user_id")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ updated: 0, message: "更新対象ユーザーなし" });
    }

    let updated = 0;
    let failed = 0;

    for (const user of users) {
      const profile = await getLineProfile(user.line_user_id, accessToken);

      if (profile) {
        const { error: updateError } = await supabase
          .from("notification_users")
          .update({
            display_name: profile.displayName,
            picture_url: profile.pictureUrl || null,
          })
          .eq("id", user.id);

        if (!updateError) {
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }

      // レート制限対策: 100ms 待機
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      updated,
      failed,
      total: users.length,
    });
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
