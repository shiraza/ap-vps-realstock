/**
 * データベースの型定義
 * 新スキーマ（watch_areas, watch_products, stock_matrix）に対応
 */

/** 監視エリアの店舗情報（JSONB内のオブジェクト） */
export interface AreaStore {
  store_id: string;   // 例: "R079"
  store_name: string; // 例: "Apple 銀座"
}

/** watch_areas テーブルの行 */
export interface WatchArea {
  id: number;
  name: string;
  postal_code: string;
  stores: AreaStore[];
  is_active: boolean;
}

/** watch_products テーブルの行 */
export interface WatchProduct {
  part_number: string;
  model_name: string;
  capacity: string;
  color: string;
  is_active: boolean;
}

/** stock_matrix テーブルの行 */
export interface StockMatrixRow {
  part_number: string;
  store_id: string;
  store_name: string;
  status: string;      // "AVAILABLE", "UNAVAILABLE", "UNKNOWN" 等
  updated_at: string;  // ISO 8601
}

/** 曜日キー */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** 通知可能曜日の設定 */
export interface NotifyDays {
  enabled: boolean;      // true のときのみ曜日制限が有効
  days: DayKey[];        // 通知する曜日のリスト（例: ["mon", "wed", "fri"]）
}

/** notification_users テーブルの行 */
export interface NotificationUser {
  id: string;              // UUID
  line_user_id: string;    // LINE ユーザーID
  display_name: string | null;  // LINEの表示名
  picture_url: string | null;   // LINEのプロフィール画像URL
  is_active: boolean;
  notify_days: NotifyDays | null;  // 曜日制限設定（null = 全曜日通知）
  created_at: string;      // ISO 8601
}

/** user_monitoring_conditions テーブルの行 */
export interface UserMonitoringCondition {
  id: string;           // UUID
  user_id: string;      // FK → notification_users.id
  part_number: string;  // FK → watch_products.part_number
  store_id: string;     // 店舗ID（例: "R381"）
  created_at: string;   // ISO 8601
}
