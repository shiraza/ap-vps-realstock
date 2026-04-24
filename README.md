# 🍎 iPhone在庫マトリックス

Apple Store 全店舗のiPhone在庫状況を、全モデル×全店舗のマトリックス表でリアルタイム表示するシステムです。

## アーキテクチャ

```
┌───────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Pythonワーカー     │────▶│   Supabase   │◀────│   Next.js       │
│  (VPS / ローカル)   │     │   (DB)       │     │   (Vercel)      │
│                   │     │              │     │                 │
│  20秒ごとに        │     │ stock_matrix │     │ マトリックス表   │
│  Apple API        │     │ watch_areas  │     │ 管理画面         │
│  ポーリング         │     │ watch_products│    │ Realtime更新    │
└───────────────────┘     └──────────────┘     └─────────────────┘
```

## セットアップ

### 1. Supabaseの設定

1. Supabase SQL Editorで `supabase/schema.sql` を実行
2. 続けて `supabase/seed.sql` を実行
3. Database > Replication で `stock_matrix` テーブルのRealtimeを有効化

### 2. フロントエンド（Next.js）

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.local を編集して Supabase の接続情報を設定

# 開発サーバーの起動
npm run dev
```

- トップページ: `http://localhost:3000` → マトリックス表
- 管理画面: `http://localhost:3000/admin` → エリア・モデルのON/OFF

### 3. Pythonワーカー（ローカル / VPS）

```bash
cd worker

# 仮想環境の構築
python -m venv venv

# 仮想環境の有効化
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 依存パッケージのインストール
pip install -r requirements.txt

# 環境変数の設定
cp .env.example .env
# .env を編集して Supabase と SmartProxy の接続情報を設定

# ワーカーの起動
python worker.py
```

## ディレクトリ構成

```
ap-vps-realstock/
├── supabase/               # DBスキーマ・初期データ
│   ├── schema.sql          # テーブル定義
│   └── seed.sql            # 初期データ
├── worker/                 # Pythonワーカー
│   ├── worker.py           # メインスクリプト
│   ├── requirements.txt    # 依存パッケージ
│   └── .env.example        # 環境変数テンプレート
├── app/                    # Next.js App Router
│   ├── page.tsx            # トップ（マトリックス表）
│   ├── admin/page.tsx      # 管理画面
│   └── api/admin/          # 管理API
├── components/             # Reactコンポーネント
│   ├── StoreStockMatrix.tsx # マトリックス表（Realtime）
│   ├── AdminAreas.tsx       # エリア管理
│   └── AdminProducts.tsx    # 商品管理
├── lib/supabase/           # Supabaseクライアント
│   ├── client.ts           # ブラウザ用（Realtime）
│   └── server.ts           # サーバー用（Service Role）
└── types/
    └── database.ts         # 型定義
```

## テーブル構成

| テーブル | 説明 |
|:---|:---|
| `watch_areas` | 監視エリア（郵便番号、店舗リスト） |
| `watch_products` | 監視対象商品（パーツ番号、モデル情報） |
| `stock_matrix` | 在庫マトリックス（モデル×店舗の在庫状況） |
