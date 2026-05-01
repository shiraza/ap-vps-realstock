import { sendLinePushMessage, buildStockAlertMessage } from './lib/notifications/line';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  const items = [{
    modelName: 'iPhone 15 Pro Max 256GB ブラック',
    storeName: 'Apple 表参道',
    partNumber: 'MG874J/A'
  }];
  const message = buildStockAlertMessage(items);
  const ok = await sendLinePushMessage('U12345678901234567890123456789012', [message]);
  console.log("Success:", ok);
}

test();
