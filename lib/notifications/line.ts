/**
 * LINE Messaging API ヘルパー
 *
 * push メッセージの送信と、在庫復活通知のメッセージテンプレート生成を提供する。
 */

// LINE Messaging API のベースURL
const LINE_API_BASE = "https://api.line.me/v2/bot/message/push";

/**
 * LINE Push Message を送信する
 *
 * @param lineUserId - 送信先のLINEユーザーID
 * @param messages - 送信するメッセージオブジェクトの配列
 * @returns 送信成功: true, 失敗: false
 */
export async function sendLinePushMessage(
  lineUserId: string,
  messages: object[]
): Promise<boolean> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
    return false;
  }

  try {
    const response = await fetch(LINE_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `LINE Push送信失敗 (${response.status}): ${errorBody}`,
        { lineUserId }
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("LINE Push送信エラー:", error, { lineUserId });
    return false;
  }
}

export interface StockAlertItem {
  modelName: string;
  storeName: string;
  partNumber: string;
}

/**
 * 在庫復活通知用のFlex Messageを生成する（複数アイテム対応）
 *
 * @param items - 復活した在庫アイテムのリスト
 * @returns LINE Flex Message オブジェクト
 */
export function buildStockAlertMessage(items: StockAlertItem[]): object {
  let text = "🍎 在庫復活のお知らせ\n\n";

  items.forEach((item) => {
    text += `【${item.modelName}】\n`;
    text += `📍 店舗: ${item.storeName}\n`;
    text += `🏷️ 型番: ${item.partNumber}\n\n`;
  });

  text += "※ 在庫は常に変動します。お早めにご確認ください。";

  return {
    type: "text",
    text: text,
  };
}
