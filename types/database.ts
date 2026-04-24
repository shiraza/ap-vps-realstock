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

/** notification_users テーブルの行 */
export interface NotificationUser {
  id: string;           // UUID
  line_user_id: string;  // LINE ユーザーID
  is_active: boolean;
  created_at: string;    // ISO 8601
}

/** user_monitoring_conditions テーブルの行 */
export interface UserMonitoringCondition {
  id: string;           // UUID
  user_id: string;      // FK → notification_users.id
  part_number: string;  // FK → watch_products.part_number
  area_id: number;      // FK → watch_areas.id
  created_at: string;   // ISO 8601
}
