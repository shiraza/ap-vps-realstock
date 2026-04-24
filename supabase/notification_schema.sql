-- ============================================================
-- LINE個別通知機能 - テーブル定義
-- Supabase SQL Editor で実行してください
--
-- ※ 既にテーブルが存在する場合は先にDROPしてください:
--    DROP TABLE IF EXISTS user_monitoring_conditions CASCADE;
--    DROP TABLE IF EXISTS notification_users CASCADE;
-- ============================================================

-- ============================================================
-- 1. notification_users: LINE通知ユーザー
--    LINEボットを友だち追加したユーザーを管理する
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  TEXT UNIQUE NOT NULL,            -- LINE ユーザーID（例: "U1234abcd..."）
  is_active     BOOLEAN NOT NULL DEFAULT true,   -- 友だち状態（unfollow時にfalse）
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE  notification_users              IS 'LINEボットの友だちユーザー管理';
COMMENT ON COLUMN notification_users.line_user_id IS 'LINE PlatformのユーザーID';
COMMENT ON COLUMN notification_users.is_active    IS 'true=友だち登録中, false=ブロック/解除済み';

-- ============================================================
-- 2. user_monitoring_conditions: ユーザーの監視条件
--    どのユーザーがどの店舗のどのモデルを監視するか（店舗レベル）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_monitoring_conditions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES notification_users(id) ON DELETE CASCADE,
  part_number  VARCHAR(20) NOT NULL REFERENCES watch_products(part_number) ON DELETE CASCADE,
  store_id     VARCHAR(20) NOT NULL,             -- 店舗ID（例: "R381" = Apple 新宿）
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- 同じユーザーが同じ店舗×商品の組み合わせを重複登録できないようにする
  UNIQUE (user_id, part_number, store_id)
);

COMMENT ON TABLE  user_monitoring_conditions IS 'ユーザーごとの在庫監視条件（店舗レベル）';
COMMENT ON COLUMN user_monitoring_conditions.user_id     IS 'notification_users への外部キー';
COMMENT ON COLUMN user_monitoring_conditions.part_number IS 'watch_products への外部キー（監視対象商品）';
COMMENT ON COLUMN user_monitoring_conditions.store_id    IS '店舗ID（watch_areasのstores JSONBに含まれるstore_id）';

-- ============================================================
-- インデックス
-- ============================================================
-- ワーカーからの通知対象検索を高速化するための複合インデックス
CREATE INDEX idx_umc_part_store ON user_monitoring_conditions (part_number, store_id);
-- ユーザー単位の条件一覧取得用
CREATE INDEX idx_umc_user       ON user_monitoring_conditions (user_id);
-- LINE ユーザーIDでの検索用
CREATE INDEX idx_nu_line_user    ON notification_users (line_user_id);

-- ============================================================
-- RLS（Row Level Security）を有効化
-- ============================================================
ALTER TABLE notification_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_monitoring_conditions   ENABLE ROW LEVEL SECURITY;

-- 読み取り許可ポリシー
CREATE POLICY "全員が読み取り可能" ON notification_users         FOR SELECT USING (true);
CREATE POLICY "全員が読み取り可能" ON user_monitoring_conditions  FOR SELECT USING (true);

-- 書き込み許可ポリシー（Service Role Keyでのみ変更可能）
CREATE POLICY "サービスロールのみ書き込み可能" ON notification_users         FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "サービスロールのみ書き込み可能" ON user_monitoring_conditions  FOR ALL USING (auth.role() = 'service_role');
