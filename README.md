# Task Manager (React + Node.js)

20年目のフロントエンドエンジニアが、フルスタック開発の基礎を学ぶためにイチから構築しているタスクマネージャーです。
単なる個人用タスクアプリから始まり、現在は **「企業や組織単位でセキュアにコラボレーションできるBtoB SaaS型」** へと進化させるプロジェクトとして運用しています。

## 📝 関連記事（Zenn連載）

このリポジトリの構築過程は、Zennの記事として連載しています。

* **第1回（バックエンド構築編）**：  
  [20年目のフロントエンドエンジニアがNode.js+PostgreSQLでバックエンドの基礎をイチから構築してみた](https://zenn.dev/goiyu/articles/b6ca3c54b3851e)
* **第2回（フロントエンド結合編）**：  
  [20年目のフロントエンドエンジニアが自作APIとReactを結合して気づいた「境界線」の壁](https://zenn.dev/goiyu/articles/c246169e21c718)
* **第3回（SaaSアーキテクチャ・認証編）**：  
  [20年目のフロントエンドエンジニアが自作タスクアプリをBtoB SaaSに進化させてみた（SaaSアーキテクチャ・認証編）](https://zenn.dev/goiyu/articles/34c552e584ba41)
* **第4回（メンバー招待・リファクタリング編）**：  
  [20年目のフロントエンドエンジニアが自作タスクアプリをBtoB SaaSに進化させてみた（メンバー招待・リファクタリング編）](https://zenn.dev/goiyu/articles/6909dd8f6c06b3)
* **第5回（アクセス権限・UI制御編）**：  
  [20年目のフロントエンドエンジニアが自作タスクアプリをBtoB SaaSに進化させてみた（アクセス権限・UI制御編）](https://zenn.dev/goiyu/articles/e4220968a5cdd8)
* **第6回（ガントチャート・ドラッグ＆ドロップ編）**：  
  [20年目のフロントエンドエンジニアが自作タスクアプリをBtoB SaaSに進化させてみた（ガントチャート・ドラッグ＆ドロップ編）](https://zenn.dev/goiyu/articles/fcca1d450abfe9)

## 🛠️ 技術スタック

**Frontend**

* [React 19](https://react.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vite.dev/)
* [Tailwind CSS (v4)](https://tailwindcss.com/)
* [Lucide React](https://lucide.dev/) (Icons)

**Backend**

* [Node.js](https://nodejs.org/ja)
* [Express](https://expressjs.com/)
* [PostgreSQL](https://www.postgresql.org/) (生のSQLによるクエリ実行)
* [pg (node-postgres)](https://node-postgres.com/)
* [bcrypt](https://github.com/kelektiv/node.bcrypt.js) (パスワードハッシュ化)
* [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) (JWT認証)

## 📁 ディレクトリ構成

保守性を考慮し、フロントエンドとバックエンドを別々のディレクトリで管理しています（モノレポ風構成）。

```bash
task-manager-react-node/
├── frontend/  # React + Vite によるフロントエンドアプリケーション
└── backend/   # Node.js + Express によるAPIサーバー
```

## 🚀 ローカル環境の立ち上げ方

手元で動かすための手順です。フロントエンドとバックエンド、それぞれのディレクトリでサーバーを起動する必要があります。

### 1. バックエンドの起動 (Port: 3000)

```bash
cd backend
npm install
```

#### 環境変数の設定

`backend`ディレクトリ内に`.env`ファイルを作成し、データベースの接続情報と認証用のシークレットキーを設定してください。  
（※ データベースの接続情報の初期値は、同梱されている`docker-compose.yml`と一致させています）

```bash
PORT=3000
DB_USER=admin
DB_HOST=localhost
DB_NAME=task-manager-db
DB_PASSWORD=password123
DB_PORT=5432

# 認証用の環境変数（任意の複雑な文字列に変更して使用してください）
JWT_SECRET=your_super_secret_jwt_key
SUPER_ADMIN_KEY=your_super_secret_key_123
```

#### データベース（PostgreSQL）の起動

Dockerを利用してローカルにデータベースを立ち上げます。  
（※ 事前にDocker Desktop等のインストールと起動が必要です）

```bash
docker-compose up -d
```

#### データベースのセットアップと起動

```bash
# テーブルの作成とテストデータの投入
npx ts-node src/setup_db.ts

# 開発サーバーの起動
npm run dev
```

### 2. フロントエンドの起動 (Port: 5173)

バックエンドを起動したまま、別のターミナルを開いて実行します。

```bash
cd frontend
npm install

# 開発サーバーの起動
npm run dev
```

起動後、ブラウザで `http://localhost:5173` にアクセスするとログイン画面が表示されます。
（テストデータのアカウント: `yamada@example.com` / `password123` でログイン可能です）

## 💡 現在の実装状況と今後のロードマップ

学習を進めながら、以下のフェーズに沿って機能を順次追加していく予定です。

### 【フェーズ1】BtoB SaaS基盤の構築（✅ 完了）
- [x] スーパーadmin専用の組織（テナント）作成API
- [x] すべてのデータをテナントIDで完全分離するマルチテナント設計
- [x] bcryptとJWTを利用したログイン・認証ミドルウェア
- [x] 複数プロジェクトの作成・切り替え機能

### 【フェーズ2】基礎的なコラボレーション機能（✅ 完了）
- [x] 組織内メンバーの招待・追加機能
- [x] プロジェクトへのアクセス権限制御（Owner / Editor / Viewer）
- [x] ガントチャートによるスケジュールの視覚化

### 【フェーズ3】UI/UXの向上とエンタープライズ機能（将来構想）（🎯 Now）
- [ ] **タスク詳細のリッチテキスト（マークダウン）対応（次のターゲット）**
- [ ] **コメント＆メンション機能（次のターゲット）**
- [ ] **高度なフィルタリング（次のターゲット）**
- [ ] 画像やファイルの添付機能
- [ ] WebSocketを利用したリアルタイム同期
- [ ] PostgreSQLのフルテキスト検索機能

## 🤝 著者
[goiyu](https://github.com/goi-yuta)
