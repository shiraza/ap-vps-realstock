-- ============================================================
-- stock_matrix に notified カラムを追加
-- ワーカーの通知漏れ防止のため、通知済みフラグを管理する
--
-- Supabase SQL Editor で実行してください
-- ============================================================

-- notified カラムを追加（存在しない場合のみ）
-- false = 未通知、true = 通知済み
ALTER TABLE stock_matrix
  ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false;

-- 現在 UNAVAILABLE のデータは notified=true にしておく
-- （AVAILABLEになった時に通知するため）
UPDATE stock_matrix SET notified = true WHERE status != 'AVAILABLE';

-- 現在 AVAILABLE のデータは notified=false のままにしておく
-- → ワーカー起動時に回復通知が送信される
COMMENT ON COLUMN stock_matrix.notified IS '通知済みフラグ（true=通知済み、false=未通知）';
