import os
import requests
from dotenv import load_dotenv

load_dotenv("worker/.env")
secret = os.getenv("NOTIFY_API_SECRET")

res = requests.post(
    "https://ap-vps-realstock.vercel.app/api/notify",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {secret}"
    },
    json={
        "alerts": [
            {
                "modelName": "iPhone 15 Pro",
                "storeName": "Apple Store",
                "partNumber": "TEST/A",
                "targetLineUserIds": ["U12345678901234567890123456789012"] 
            }
        ]
    }
)

print(res.status_code)
print(res.text)
