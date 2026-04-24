-- ============================================================
-- ワーカー設定テーブルの追加
-- schema.sql の実行後に実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS worker_settings (
  key   VARCHAR(50) PRIMARY KEY,
  value VARCHAR(200) NOT NULL
);

COMMENT ON TABLE worker_settings IS 'ワーカーの動的設定（管理画面から変更可能）';

-- 初期値: 20秒間隔
INSERT INTO worker_settings (key, value) VALUES ('poll_interval', '20')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE worker_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "全員が読み取り可能" ON worker_settings FOR SELECT USING (true);
CREATE POLICY "サービスロールのみ書き込み可能" ON worker_settings FOR ALL USING (auth.role() = 'service_role');
