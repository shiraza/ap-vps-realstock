import { buildStockAlertMessage } from './lib/notifications/line';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  const message = buildStockAlertMessage([{modelName: 'iPhone 15', storeName: 'Apple Ginza', partNumber: 'MTXX3J/A'}]);
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!token) {
    console.error("No token");
    return;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/validate/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messages: [message]
    })
  });
  
  console.log(res.status);
  console.log(await res.text());
}

test();
