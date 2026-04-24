/**
 * LINE Webhook 受信API
 *
 * LINEプラットフォームからのWebhookイベントを処理する。
 * - follow（友だち追加） → プロフィール取得 → notification_users に upsert
 * - unfollow（ブロック/解除） → is_active を false に更新
 *
 * セキュリティ: X-Line-Signature によるHMAC-SHA256署名検証
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

// LINE Webhook の署名を検証する
function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error("LINE_CHANNEL_SECRET が設定されていません");
    return false;
  }

  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

/**
 * LINE Profile API からユーザーのプロフィールを取得する
 */
async function getLineProfile(
  userId: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
    return null;
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.error(`LINE Profile取得失敗 (${res.status}):`, await res.text());
      return null;
    }

    const data = await res.json();
    return {
      displayName: data.displayName || "不明",
      pictureUrl: data.pictureUrl || undefined,
    };
  } catch (error) {
    console.error("LINE Profile取得エラー:", error);
    return null;
  }
}

// LINE Webhook イベントの型定義
interface LineEvent {
  type: string;
  source?: {
    type: string;
    userId?: string;
  };
  replyToken?: string;
}

interface LineWebhookBody {
  events: LineEvent[];
}

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを文字列として取得（署名検証用）
    const bodyText = await request.text();

    // 署名検証
    const signature = request.headers.get("x-line-signature");
    if (!signature) {
      console.warn("X-Line-Signature ヘッダーがありません");
      return NextResponse.json(
        { error: "署名がありません" },
        { status: 401 }
      );
    }

    if (!verifySignature(bodyText, signature)) {
      console.warn("LINE Webhook署名検証に失敗しました");
      return NextResponse.json(
        { error: "署名が無効です" },
        { status: 401 }
      );
    }

    // JSONパース
    const body: LineWebhookBody = JSON.parse(bodyText);
    const events = body.events || [];

    // LINE側の「接続確認（verify）」リクエスト対応
    // events が空配列の場合は正常応答を返す
    if (events.length === 0) {
      return NextResponse.json({ message: "OK" }, { status: 200 });
    }

    const supabase = getSupabaseServer();

    // 各イベントを処理
    for (const event of events) {
      const userId = event.source?.userId;
      if (!userId) continue;

      if (event.type === "follow") {
        // LINE Profile API からユーザー情報を取得
        const profile = await getLineProfile(userId);

        // 友だち追加 → notification_users に upsert（プロフィール情報付き）
        const { error } = await supabase
          .from("notification_users")
          .upsert(
            {
              line_user_id: userId,
              display_name: profile?.displayName || null,
              picture_url: profile?.pictureUrl || null,
              is_active: true,
            },
            { onConflict: "line_user_id" }
          );

        if (error) {
          console.error(`友だち追加の保存に失敗: ${error.message}`, { userId });
        } else {
          console.log(
            `✅ 友だち追加を保存: ${profile?.displayName || userId}`
          );
        }
      } else if (event.type === "unfollow") {
        // ブロック/友だち解除 → is_active を false に更新
        const { error } = await supabase
          .from("notification_users")
          .update({ is_active: false })
          .eq("line_user_id", userId);

        if (error) {
          console.error(`友だち解除の更新に失敗: ${error.message}`, { userId });
        } else {
          console.log(`📤 友だち解除を記録: ${userId}`);
        }
      }
    }

    // LINE Platformへは常に200を返す（必須）
    return NextResponse.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    console.error("LINE Webhook処理エラー:", error);
    // LINE Platformへは常に200を返す（エラーでも再送を防ぐため）
    return NextResponse.json({ message: "OK" }, { status: 200 });
  }
}
