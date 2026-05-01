import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("worker/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

res = supabase.table("stock_matrix").select("*").eq("status", "AVAILABLE").execute()
available_items = res.data

print(f"Total AVAILABLE items: {len(available_items)}")
for item in available_items:
    print(f"- {item['store_name']} ({item['part_number']}): notified={item.get('notified')}")
