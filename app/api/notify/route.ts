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
  StockAlertItem,
} from "@/lib/notifications/line";

// リクエストボディの型定義
interface StockAlert {
  modelName: string;       // モデル名（例: "iPhone 17 Pro Max 256GB シルバー"）
  storeName: string;       // 店舗名（例: "Apple 銀座"）
  partNumber: string;      // パーツ番号（例: "MFY84J/A"）
  targetLineUserIds: string[];  // 通知対象のLINEユーザーIDリスト
}

interface NotifyRequestBody {
  alerts: StockAlert[];
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
    const { alerts } = body;

    // バリデーション
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return NextResponse.json(
        { error: "alerts配列は必須です" },
        { status: 400 }
      );
    }

    // ユーザーごとに通知内容をグループ化する
    const userAlertsMap = new Map<string, StockAlertItem[]>();

    for (const alert of alerts) {
      if (!alert.modelName || !alert.storeName || !alert.partNumber) {
        continue;
      }
      if (!Array.isArray(alert.targetLineUserIds) || alert.targetLineUserIds.length === 0) {
        continue;
      }

      for (const lineUserId of alert.targetLineUserIds) {
        if (!userAlertsMap.has(lineUserId)) {
          userAlertsMap.set(lineUserId, []);
        }
        userAlertsMap.get(lineUserId)!.push({
          modelName: alert.modelName,
          storeName: alert.storeName,
          partNumber: alert.partNumber,
        });
      }
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // ユーザーごとにまとめて送信
    for (const [lineUserId, items] of Array.from(userAlertsMap.entries())) {
      if (items.length === 0) continue;

      // LINE Flex Messageの要素数制限（100件程度）を回避するため、
      // 1つのメッセージにつき最大10件の商品に分割する
      const maxItemsPerMessage = 10;
      const flexMessages = [];
      for (let i = 0; i < items.length; i += maxItemsPerMessage) {
        const chunk = items.slice(i, i + maxItemsPerMessage);
        flexMessages.push(buildStockAlertMessage(chunk));
      }

      // LINE push APIは1回のリクエストで最大5メッセージまで送信可能
      const maxMessagesPerPush = 5;
      let userSuccess = true;
      for (let i = 0; i < flexMessages.length; i += maxMessagesPerPush) {
        const pushChunk = flexMessages.slice(i, i + maxMessagesPerPush);
        const ok = await sendLinePushMessage(lineUserId, pushChunk);
        if (!ok) {
          userSuccess = false;
        }
      }

      if (userSuccess) {
        successCount++;
      } else {
        failureCount++;
        errors.push(lineUserId);
      }
    }

    console.log(
      `📨 LINE一括通知送信完了: 成功(ユーザー数)=${successCount}, 失敗=${failureCount}`,
      { itemsProcessed: alerts.length }
    );

    // 全ユーザーへの送信が失敗した場合、ワーカー側で再試行させるために500エラーを返す
    if (successCount === 0 && failureCount > 0) {
      return NextResponse.json(
        { error: "すべてのLINE通知に失敗しました", details: errors },
        { status: 500 }
      );
    }

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
