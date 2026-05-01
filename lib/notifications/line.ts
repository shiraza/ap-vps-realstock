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
  const itemContents: any[] = [];

  items.forEach((item, index) => {
    itemContents.push({
      type: "box",
      layout: "vertical",
      margin: index === 0 ? "none" : "xl",
      contents: [
        {
          type: "text",
          text: item.modelName,
          weight: "bold",
          size: "lg",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 店舗",
                  size: "sm",
                  color: "#888888",
                  flex: 2,
                },
                {
                  type: "text",
                  text: item.storeName,
                  size: "sm",
                  weight: "bold",
                  flex: 5,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🏷️ 型番",
                  size: "sm",
                  color: "#888888",
                  flex: 2,
                },
                {
                  type: "text",
                  text: item.partNumber,
                  size: "sm",
                  flex: 5,
                },
              ],
            },
          ],
        },
      ],
    });

    // 最後のアイテムでなければ区切り線を入れる
    if (index < items.length - 1) {
      itemContents.push({
        type: "separator",
        margin: "xl",
      });
    }
  });

  const altText =
    items.length > 1
      ? `🍎 在庫復活: ${items[0].modelName} ほか計${items.length}件`
      : `🍎 在庫復活: ${items[0].modelName} @ ${items[0].storeName}`;

  return {
    type: "flex",
    altText: altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🍎 在庫復活！",
            weight: "bold",
            size: "xl",
            color: "#1DB446",
          },
        ],
        backgroundColor: "#F0FFF0",
        paddingAll: "15px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          ...itemContents,
          {
            type: "separator",
            margin: "xl",
          },
          {
            type: "text",
            text: "※ 在庫は常に変動します。お早めにご確認ください。",
            size: "xs",
            color: "#999999",
            margin: "md",
            wrap: true,
          },
        ],
        paddingAll: "15px",
      },
    },
  };
}
