import os
import json
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")
token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")

if not token:
    print("No token")
    exit(1)

items = [{"modelName": "iPhone 15", "storeName": "Apple Ginza", "partNumber": "MTXX3J/A"}]

itemContents = []
for index, item in enumerate(items):
    itemContents.append({
        "type": "box",
        "layout": "vertical",
        "margin": "none" if index == 0 else "xl",
        "contents": [
            {
                "type": "text",
                "text": item["modelName"],
                "weight": "bold",
                "size": "lg",
                "wrap": True,
            },
            {
                "type": "box",
                "layout": "vertical",
                "margin": "md",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "text",
                                "text": "📍 店舗",
                                "size": "sm",
                                "color": "#888888",
                                "flex": 2,
                            },
                            {
                                "type": "text",
                                "text": item["storeName"],
                                "size": "sm",
                                "weight": "bold",
                                "flex": 5,
                                "wrap": True,
                            },
                        ],
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "text",
                                "text": "🏷️ 型番",
                                "size": "sm",
                                "color": "#888888",
                                "flex": 2,
                            },
                            {
                                "type": "text",
                                "text": item["partNumber"],
                                "size": "sm",
                                "flex": 5,
                            },
                        ],
                    },
                ],
            },
        ],
    })

    if index < len(items) - 1:
        itemContents.append({
            "type": "separator",
            "margin": "xl",
        })

altText = "🍎 在庫復活: " + items[0]["modelName"]

message = {
    "type": "flex",
    "altText": altText,
    "contents": {
        "type": "bubble",
        "size": "mega",
        "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": "🍎 在庫復活！",
                    "weight": "bold",
                    "size": "xl",
                    "color": "#1DB446",
                },
            ],
            "backgroundColor": "#F0FFF0",
            "paddingAll": "15px",
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": itemContents + [
                {
                    "type": "separator",
                    "margin": "xl",
                },
                {
                    "type": "text",
                    "text": "※ 在庫は常に変動します。お早めにご確認ください。",
                    "size": "xs",
                    "color": "#999999",
                    "margin": "md",
                    "wrap": True,
                },
            ],
            "paddingAll": "15px",
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#0066CC",
                    "action": {
                        "type": "uri",
                        "label": "バッグ（保存済みアイテム）を開く",
                        "uri": "https://www.apple.com/jp/shop/bag",
                    },
                },
            ],
            "paddingAll": "15px",
        },
    },
}

res = requests.post(
    "https://api.line.me/v2/bot/message/validate/push",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    },
    json={
        "messages": [message]
    }
)

print(res.status_code)
print(res.text)
