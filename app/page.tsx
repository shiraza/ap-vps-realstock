/**
 * トップページ: 在庫マトリックス表
 * サーバーサイドで初期データを取得し、クライアントでRealtime購読
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import StoreStockMatrix from "@/components/StoreStockMatrix";
import type { StockMatrixRow, WatchProduct } from "@/types/database";

// ランタイム実行（ビルド時のプリレンダリングを防止）
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let matrixData: StockMatrixRow[] = [];
  let products: WatchProduct[] = [];

  try {
    const supabase = getSupabaseServer();

    // stock_matrix の全データを取得
    const { data: matrixRows } = await supabase
      .from("stock_matrix")
      .select("*")
      .order("part_number");

    matrixData = (matrixRows as StockMatrixRow[]) || [];

    // アクティブな商品を取得
    const { data: productRows } = await supabase
      .from("watch_products")
      .select("*")
      .eq("is_active", true)
      .order("model_name");

    products = (productRows as WatchProduct[]) || [];
  } catch (error) {
    console.error("データ取得エラー:", error);
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">
          在庫状況マトリックス
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Apple Store 全店舗のiPhone在庫をリアルタイムで監視中
        </p>
      </div>

      {/* マトリックス表 */}
      <StoreStockMatrix initialMatrix={matrixData} products={products} />
    </div>
  );
}
