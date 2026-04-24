-- ============================================================
-- LINE個別通知機能 - テーブル定義
-- Supabase SQL Editor で実行してください
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
--    どのユーザーがどのエリアのどのモデルを監視するか
-- ============================================================
CREATE TABLE IF NOT EXISTS user_monitoring_conditions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES notification_users(id) ON DELETE CASCADE,
  part_number  VARCHAR(20) NOT NULL REFERENCES watch_products(part_number) ON DELETE CASCADE,
  area_id      INTEGER     NOT NULL REFERENCES watch_areas(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- 同じユーザーが同じエリア×商品の組み合わせを重複登録できないようにする
  UNIQUE (user_id, part_number, area_id)
);

COMMENT ON TABLE  user_monitoring_conditions IS 'ユーザーごとの在庫監視条件';
COMMENT ON COLUMN user_monitoring_conditions.user_id     IS 'notification_users への外部キー';
COMMENT ON COLUMN user_monitoring_conditions.part_number IS 'watch_products への外部キー（監視対象商品）';
COMMENT ON COLUMN user_monitoring_conditions.area_id     IS 'watch_areas への外部キー（監視対象エリア）';

-- ============================================================
-- インデックス
-- ============================================================
-- ワーカーからの通知対象検索を高速化するための複合インデックス
CREATE INDEX idx_umc_part_area ON user_monitoring_conditions (part_number, area_id);
-- ユーザー単位の条件一覧取得用
CREATE INDEX idx_umc_user      ON user_monitoring_conditions (user_id);
-- LINE ユーザーIDでの検索用
CREATE INDEX idx_nu_line_user   ON notification_users (line_user_id);

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
