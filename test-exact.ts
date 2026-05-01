import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { sendLinePushMessage, buildStockAlertMessage } from './lib/notifications/line';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'worker/.env' });

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(url, key);

async function test() {
  // Get pending items
  const { data: pending } = await supabase
    .from('stock_matrix')
    .select('part_number, store_id, store_name, status')
    .eq('status', 'AVAILABLE')
    .eq('notified', false);

  if (!pending || pending.length === 0) {
    console.log("No pending items");
    return;
  }

  console.log("Pending:", pending);

  for (const row of pending) {
    const { part_number, store_id, store_name } = row;
    
    // Get targets
    const { data: conditions } = await supabase
      .from('user_monitoring_conditions')
      .select('user_id')
      .eq('part_number', part_number)
      .eq('store_id', store_id);
      
    if (!conditions || conditions.length === 0) continue;
    
    const userIds = conditions.map(c => c.user_id);
    
    const { data: users } = await supabase
      .from('notification_users')
      .select('line_user_id')
      .in('id', userIds)
      .eq('is_active', true);
      
    const lineUserIds = users?.map(u => u.line_user_id) || [];
    console.log("Targets:", lineUserIds);

    // Get product info
    const { data: products } = await supabase
      .from('watch_products')
      .select('model_name, capacity, color')
      .eq('part_number', part_number);
      
    let modelName = "Unknown";
    if (products && products.length > 0) {
      const p = products[0];
      const isProMax = p.model_name.includes("Pro Max") || p.model_name.includes("ProMax");
      const isPro = !isProMax && p.model_name.includes("Pro");
      const shortCap = p.capacity.replace("GB", "").replace("TB", "TB");
      
      let shortModel = p.model_name;
      if (isProMax) {
          if (shortCap === "256") shortModel = "★Max";
          else if (shortCap === "512") shortModel = "●Max";
          else shortModel = "Max";
      } else if (isPro) {
          shortModel = "Pro";
      }
      
      let shortColor = p.color;
      shortColor = shortColor.replace("コズミックオレンジ", "オレンジ").replace("ディープブルー", "ブルー");
      
      modelName = `${shortModel}${shortCap}${shortColor}`;
    }

    console.log("Model:", modelName);

    const message = buildStockAlertMessage([{
      modelName: modelName,
      storeName: store_name,
      partNumber: part_number
    }]);

    for (const lid of lineUserIds) {
      console.log(`Sending to ${lid}...`);
      const ok = await sendLinePushMessage(lid, [message]);
      console.log(`Result: ${ok}`);
    }
  }
}

test();
