import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "iPhone在庫マトリックス",
  description:
    "Apple Store 全店舗のiPhone在庫状況をリアルタイムで一覧表示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased" suppressHydrationWarning>
        {/* ナビゲーション */}
        <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a
                href="/"
                className="flex items-center gap-2 text-lg font-bold text-gray-100 hover:text-white transition-colors"
              >
                <span className="text-xl">🍎</span>
                <span>iPhone在庫マトリックス</span>
              </a>
              <div className="flex items-center gap-4">
                <a
                  href="/"
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  在庫一覧
                </a>
                <a
                  href="/admin"
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700/50 hover:border-gray-600/50"
                >
                  ⚙️ 管理
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* メインコンテンツ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* フッター */}
        <footer className="border-t border-gray-800/40 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-xs text-gray-600">
              iPhone在庫マトリックス — Apple Store在庫リアルタイム監視
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
