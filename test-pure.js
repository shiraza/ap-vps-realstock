const fs = require('fs');
require('dotenv').config();

const items = [{modelName: 'iPhone 15', storeName: 'Apple Ginza', partNumber: 'MTXX3J/A'}];

const itemContents = [];

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

  if (index < items.length - 1) {
    itemContents.push({
      type: "separator",
      margin: "xl",
    });
  }
});

const altText = "🍎 在庫復活: " + items[0].modelName;

const message = {
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

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

fetch("https://api.line.me/v2/bot/message/validate/push", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    messages: [message]
  })
}).then(res => {
  console.log(res.status);
  return res.text();
}).then(text => {
  console.log(text);
});
