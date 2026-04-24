/**
 * 通知送信 APIルート
 *
 * Pythonワーカーから呼び出され、指定されたLINEユーザーに在庫復活通知を送信する。
 * 認証: Authorization ヘッダーに Bearer トークン（NOTIFY_API_SECRET）が必要。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  sendLinePushMessage,
  buildStockAlertMessage,
} from "@/lib/notifications/line";

// リクエストボディの型定義
interface NotifyRequestBody {
  modelName: string;       // モデル名（例: "iPhone 17 Pro Max 256GB シルバー"）
  storeName: string;       // 店舗名（例: "Apple 銀座"）
  partNumber: string;      // パーツ番号（例: "MFY84J/A"）
  targetLineUserIds: string[];  // 通知対象のLINEユーザーIDリスト
}

/**
 * APIキー認証を検証する
 */
function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.NOTIFY_API_SECRET;
  if (!secret) {
    console.error("NOTIFY_API_SECRET が設定されていません");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token === secret;
}

export async function POST(request: NextRequest) {
  // 認証チェック
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { error: "認証に失敗しました" },
      { status: 401 }
    );
  }

  try {
    const body: NotifyRequestBody = await request.json();
    const { modelName, storeName, partNumber, targetLineUserIds } = body;

    // バリデーション
    if (!modelName || !storeName || !partNumber) {
      return NextResponse.json(
        { error: "modelName, storeName, partNumber は必須です" },
        { status: 400 }
      );
    }

    if (!Array.isArray(targetLineUserIds) || targetLineUserIds.length === 0) {
      return NextResponse.json(
        { error: "targetLineUserIds は1人以上必要です" },
        { status: 400 }
      );
    }

    // Flex Messageを生成
    const message = buildStockAlertMessage(modelName, storeName, partNumber);

    // 各ユーザーにpush送信
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const lineUserId of targetLineUserIds) {
      const ok = await sendLinePushMessage(lineUserId, [message]);
      if (ok) {
        successCount++;
      } else {
        failureCount++;
        errors.push(lineUserId);
      }
    }

    console.log(
      `📨 LINE通知送信完了: 成功=${successCount}, 失敗=${failureCount}`,
      { modelName, storeName, partNumber }
    );

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("通知送信APIエラー:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
