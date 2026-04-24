-- ============================================================
-- user_monitoring_conditions: area_id → store_id への変更
-- 既存データがある場合にこのSQLを実行してください
-- ============================================================

-- 1. 既存テーブルを削除（データも削除されます）
DROP TABLE IF EXISTS user_monitoring_conditions CASCADE;

-- 2. 新しいテーブルを作成（store_id版）
CREATE TABLE user_monitoring_conditions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES notification_users(id) ON DELETE CASCADE,
  part_number  VARCHAR(20) NOT NULL REFERENCES watch_products(part_number) ON DELETE CASCADE,
  store_id     VARCHAR(20) NOT NULL,             -- 店舗ID（例: "R381" = Apple 新宿）
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, part_number, store_id)
);

-- 3. インデックス
CREATE INDEX idx_umc_part_store ON user_monitoring_conditions (part_number, store_id);
CREATE INDEX idx_umc_user       ON user_monitoring_conditions (user_id);

-- 4. RLS
ALTER TABLE user_monitoring_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "全員が読み取り可能" ON user_monitoring_conditions FOR SELECT USING (true);
CREATE POLICY "サービスロールのみ書き込み可能" ON user_monitoring_conditions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- notification_users に表示名・画像URLカラムを追加
-- ============================================================
ALTER TABLE notification_users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE notification_users ADD COLUMN IF NOT EXISTS picture_url TEXT;
