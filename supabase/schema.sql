-- ============================================================
-- iPhone在庫監視システム - テーブル定義
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 既存テーブルがある場合は削除（依存関係の順序に注意）
DROP TABLE IF EXISTS stock_matrix CASCADE;
DROP TABLE IF EXISTS watch_products CASCADE;
DROP TABLE IF EXISTS watch_areas CASCADE;

-- ============================================================
-- 1. watch_areas: 監視エリア
-- ============================================================
CREATE TABLE watch_areas (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,          -- エリア名（例: "関東エリア"）
  postal_code VARCHAR(10)  NOT NULL,          -- 郵便番号（例: "160-0022"）
  stores      JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- 店舗リスト [{store_id, store_name}, ...]
  is_active   BOOLEAN      NOT NULL DEFAULT true
);

COMMENT ON TABLE  watch_areas             IS '監視対象エリア';
COMMENT ON COLUMN watch_areas.stores      IS '店舗リスト: [{store_id: "R079", store_name: "Apple 銀座"}, ...]';
COMMENT ON COLUMN watch_areas.postal_code IS 'Apple APIに送信する郵便番号';

-- ============================================================
-- 2. watch_products: 監視対象商品
-- ============================================================
CREATE TABLE watch_products (
  part_number VARCHAR(20)  PRIMARY KEY,       -- パーツ番号（例: "MFY84J/A"）
  model_name  VARCHAR(100) NOT NULL,          -- モデル名（例: "iPhone 17 Pro Max"）
  capacity    VARCHAR(20)  NOT NULL,          -- 容量（例: "256GB"）
  color       VARCHAR(50)  NOT NULL,          -- カラー（例: "シルバー"）
  is_active   BOOLEAN      NOT NULL DEFAULT true
);

COMMENT ON TABLE  watch_products IS '監視対象の商品（パーツ番号単位）';

-- ============================================================
-- 3. stock_matrix: 在庫マトリックス
-- ============================================================
CREATE TABLE stock_matrix (
  part_number VARCHAR(20) NOT NULL REFERENCES watch_products(part_number) ON DELETE CASCADE,
  store_id    VARCHAR(20) NOT NULL,           -- 店舗ID（例: "R079"）
  store_name  VARCHAR(100) NOT NULL,          -- 店舗名（例: "Apple 銀座"）
  status      VARCHAR(50)  NOT NULL DEFAULT 'UNKNOWN', -- 在庫ステータス（AVAILABLE, UNAVAILABLE, UNKNOWN等）
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (part_number, store_id)
);

COMMENT ON TABLE  stock_matrix IS '在庫マトリックス（モデル×店舗の在庫状況）';
COMMENT ON COLUMN stock_matrix.status IS 'Apple APIの pickupDisplay 値をそのまま格納';

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_stock_matrix_store    ON stock_matrix (store_id);
CREATE INDEX idx_stock_matrix_status   ON stock_matrix (status);
CREATE INDEX idx_stock_matrix_updated  ON stock_matrix (updated_at);
CREATE INDEX idx_watch_products_active ON watch_products (is_active);
CREATE INDEX idx_watch_areas_active    ON watch_areas (is_active);

-- ============================================================
-- RLS（Row Level Security）を有効化
-- 読み取りは全員許可、書き込みはService Role Keyのみ
-- ============================================================
ALTER TABLE watch_areas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_matrix   ENABLE ROW LEVEL SECURITY;

-- 読み取り許可ポリシー
CREATE POLICY "全員が読み取り可能" ON watch_areas    FOR SELECT USING (true);
CREATE POLICY "全員が読み取り可能" ON watch_products  FOR SELECT USING (true);
CREATE POLICY "全員が読み取り可能" ON stock_matrix    FOR SELECT USING (true);

-- 書き込み許可ポリシー（Service Role Keyでのみ変更可能）
CREATE POLICY "サービスロールのみ書き込み可能" ON watch_areas    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "サービスロールのみ書き込み可能" ON watch_products  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "サービスロールのみ書き込み可能" ON stock_matrix    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Realtime を有効化（stock_matrix テーブル）
-- ダッシュボードの Database > Replication でも設定可能
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE stock_matrix;
