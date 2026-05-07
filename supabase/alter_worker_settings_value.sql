-- ============================================================
-- worker_settings.value カラムを TEXT に変更
-- スケジュールのJSON等、200文字を超えるデータを保存するため
-- ============================================================

ALTER TABLE worker_settings ALTER COLUMN value TYPE TEXT;
