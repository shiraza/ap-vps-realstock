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

/**
 * 在庫復活通知用のFlex Messageを生成する
 *
 * @param modelName - モデル名（例: "iPhone 17 Pro Max 256GB シルバー"）
 * @param storeName - 店舗名（例: "Apple 銀座"）
 * @param partNumber - パーツ番号（例: "MFY84J/A"）
 * @returns LINE Flex Message オブジェクト
 */
export function buildStockAlertMessage(
  modelName: string,
  storeName: string,
  partNumber: string
): object {
  // Apple Store の購入ページURL
  const appleStoreUrl = `https://www.apple.com/jp/shop/buy-iphone`;

  return {
    type: "flex",
    altText: `🍎 在庫復活: ${modelName} @ ${storeName}`,
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
          {
            type: "text",
            text: modelName,
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "separator",
            margin: "md",
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
                    text: storeName,
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
                    text: partNumber,
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
            ],
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
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "Apple Store で確認する",
              uri: appleStoreUrl,
            },
            style: "primary",
            color: "#0071E3",
            height: "sm",
          },
        ],
        paddingAll: "15px",
      },
    },
  };
}
