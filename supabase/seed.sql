-- ============================================================
-- iPhone在庫監視システム - 初期データ (Seed)
-- schema.sql を実行した後に実行してください
-- ============================================================

-- ============================================================
-- 1. watch_areas: 関東エリア（新宿起点: 160-0022）
-- ============================================================
INSERT INTO watch_areas (name, postal_code, stores, is_active) VALUES
(
  '関東エリア',
  '160-0022',
  '[
    {"store_id": "R079", "store_name": "Apple 銀座"},
    {"store_id": "R119", "store_name": "Apple 渋谷"},
    {"store_id": "R128", "store_name": "Apple 新宿"},
    {"store_id": "R224", "store_name": "Apple 表参道"},
    {"store_id": "R710", "store_name": "Apple 川崎"},
    {"store_id": "R718", "store_name": "Apple 丸の内"}
  ]'::jsonb,
  true
);

-- ============================================================
-- 2. watch_products: iPhone 17 Pro / Pro Max（256GB・512GB = 各6モデル、計12モデル）
-- ============================================================

-- iPhone 17 Pro 256GB
INSERT INTO watch_products (part_number, model_name, capacity, color, is_active) VALUES
('MG854J/A', 'iPhone 17 Pro', '256GB', 'シルバー', true),
('MG864J/A', 'iPhone 17 Pro', '256GB', 'コズミックオレンジ', true),
('MG874J/A', 'iPhone 17 Pro', '256GB', 'ディープブルー', true);

-- iPhone 17 Pro 512GB
INSERT INTO watch_products (part_number, model_name, capacity, color, is_active) VALUES
('MG894J/A', 'iPhone 17 Pro', '512GB', 'シルバー', true),
('MG8A4J/A', 'iPhone 17 Pro', '512GB', 'コズミックオレンジ', true),
('MG8C4J/A', 'iPhone 17 Pro', '512GB', 'ディープブルー', true);

-- iPhone 17 Pro Max 256GB
INSERT INTO watch_products (part_number, model_name, capacity, color, is_active) VALUES
('MFY84J/A', 'iPhone 17 Pro Max', '256GB', 'シルバー', true),
('MFY94J/A', 'iPhone 17 Pro Max', '256GB', 'コズミックオレンジ', true),
('MFYA4J/A', 'iPhone 17 Pro Max', '256GB', 'ディープブルー', true);

-- iPhone 17 Pro Max 512GB
INSERT INTO watch_products (part_number, model_name, capacity, color, is_active) VALUES
('MFYC4J/A', 'iPhone 17 Pro Max', '512GB', 'シルバー', true),
('MFYD4J/A', 'iPhone 17 Pro Max', '512GB', 'コズミックオレンジ', true),
('MFYE4J/A', 'iPhone 17 Pro Max', '512GB', 'ディープブルー', true);
