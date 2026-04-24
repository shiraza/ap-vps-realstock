/**
 * 管理画面: /admin
 * エリア管理、商品管理、ワーカー設定、LINE通知ユーザー管理のUI
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import AdminAreas from "@/components/AdminAreas";
import AdminProducts from "@/components/AdminProducts";
import AdminWorkerSettings from "@/components/AdminWorkerSettings";
import AdminUsers from "@/components/AdminUsers";
import type {
  WatchArea,
  WatchProduct,
  NotificationUser,
  UserMonitoringCondition,
} from "@/types/database";

// ISRなし（常に最新データを取得）
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let areas: WatchArea[] = [];
  let products: WatchProduct[] = [];
  let pollInterval = 30;
  let notificationUsers: NotificationUser[] = [];
  let monitoringConditions: UserMonitoringCondition[] = [];

  try {
    const supabase = getSupabaseServer();

    const { data: areasData } = await supabase
      .from("watch_areas")
      .select("*")
      .order("id");
    areas = (areasData as WatchArea[]) || [];

    const { data: productsData } = await supabase
      .from("watch_products")
      .select("*")
      .order("model_name");
    products = (productsData as WatchProduct[]) || [];

    // ポーリング間隔を取得
    const { data: settingsData } = await supabase
      .from("worker_settings")
      .select("value")
      .eq("key", "poll_interval")
      .single();
    if (settingsData) {
      const parsed = parseInt(settingsData.value, 10);
      pollInterval = isNaN(parsed) ? 30 : parsed;
    }

    // LINE通知ユーザーを取得
    const { data: usersData } = await supabase
      .from("notification_users")
      .select("*")
      .order("created_at", { ascending: false });
    notificationUsers = (usersData as NotificationUser[]) || [];

    // 監視条件を取得
    const { data: conditionsData } = await supabase
      .from("user_monitoring_conditions")
      .select("*");
    monitoringConditions =
      (conditionsData as UserMonitoringCondition[]) || [];
  } catch (error) {
    console.error("管理画面データ取得エラー:", error);
  }

  return (
    <div className="space-y-10">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">⚙️ 管理画面</h1>
        <p className="text-sm text-gray-400 mt-1">
          監視エリア・モデルのON/OFFとワーカー設定を管理できます
        </p>
      </div>

      {/* ワーカー設定 */}
      <AdminWorkerSettings initialInterval={pollInterval} />

      {/* 区切り線 */}
      <hr className="border-gray-800/50" />

      {/* エリア管理 */}
      <AdminAreas initialAreas={areas} />

      {/* 区切り線 */}
      <hr className="border-gray-800/50" />

      {/* 商品管理 */}
      <AdminProducts initialProducts={products} />

      {/* 区切り線 */}
      <hr className="border-gray-800/50" />

      {/* LINE通知ユーザー管理 */}
      <AdminUsers
        initialUsers={notificationUsers}
        initialConditions={monitoringConditions}
        areas={areas}
        products={products}
      />
    </div>
  );
}
