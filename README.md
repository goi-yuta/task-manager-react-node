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

## 🛠️ 技術スタック

**Frontend**

* React 19
* TypeScript
* Vite
* Tailwind CSS (v4)
* Lucide React (Icons)

**Backend**

* Node.js
* Express
* PostgreSQL (生のSQLによるクエリ実行)
* pg (node-postgres)
* bcrypt (パスワードハッシュ化)
* jsonwebtoken (JWT認証)

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

```bash
PORT=3000
DB_USER=your_postgres_user
DB_HOST=localhost
DB_NAME=task_manager
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# 認証用の環境変数
JWT_SECRET=your_super_secret_jwt_key
SUPER_ADMIN_KEY=my_super_secret_key_123
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

### 【フェーズ2】基礎的なコラボレーション機能（🎯 Now）
- [x] **組織内メンバーの招待・追加機能（次のターゲット）**
- [ ] プロジェクトへのアクセス権限制御（Owner / Editor / Viewer）
- [ ] ガントチャートによるスケジュールの視覚化

### 【フェーズ3】UI/UXの向上とエンタープライズ機能（将来構想）
- [ ] タスク詳細のリッチテキスト（マークダウン）対応
- [ ] コメント＆メンション機能
- [ ] 画像やファイルの添付機能
- [ ] WebSocketを利用したリアルタイム同期
- [ ] PostgreSQLのフルテキスト検索機能

## 🤝 著者
[goiyu](https://github.com/goi-yuta)
