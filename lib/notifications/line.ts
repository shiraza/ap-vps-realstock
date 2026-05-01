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
  const storeMap = new Map<string, string[]>();

  items.forEach((item) => {
    const shortStoreName = item.storeName.replace("Apple ", "");
    if (!storeMap.has(shortStoreName)) {
      storeMap.set(shortStoreName, []);
    }
    storeMap.get(shortStoreName)!.push(item.modelName);
  });

  let text = "🍎 在庫復活のお知らせ\n\n";

  for (const [store, models] of storeMap.entries()) {
    text += `【${store}】\n`;
    
    // カスタムソート: ★Max -> ●Max -> Pro -> その他
    models.sort((a, b) => {
      const getPriority = (name: string) => {
        if (name.includes("★Max")) return 1;
        if (name.includes("●Max")) return 2;
        if (name.includes("Pro")) return 3;
        return 4;
      };
      
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.localeCompare(b, 'ja');
    });

    models.forEach((model) => {
      text += `${model}\n`;
    });
    text += "\n";
  }

  return {
    type: "text",
    text: text.trim(),
  };
}
