/**
 * ブラウザ用 Supabase クライアント
 * Realtime購読に使用（NEXT_PUBLIC_* の環境変数を使用）
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  instance = createClient(url, key);
  return instance;
}

// 後方互換（インポート時に即座に初期化しない）
// StoreStockMatrixではuseEffect内で呼び出す
export const supabase = typeof window !== "undefined"
  ? getSupabaseBrowser()
  : (null as unknown as SupabaseClient);
