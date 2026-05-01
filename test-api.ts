import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const secret = process.env.NOTIFY_API_SECRET;
const port = 3000;

async function test() {
  const res = await fetch(`http://localhost:${port}/api/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`
    },
    body: JSON.stringify({
      alerts: [
        {
          modelName: 'iPhone 15',
          storeName: 'Apple Ginza',
          partNumber: 'MTXX3J/A',
          targetLineUserIds: ['U12345678901234567890123456789012'] // dummy
        }
      ]
    })
  });
  console.log(res.status);
  console.log(await res.text());
}

test();
