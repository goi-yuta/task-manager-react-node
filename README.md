# Task Manager (React + Node.js)

20年目のフロントエンドエンジニアが、フルスタック開発の基礎を学ぶためにイチから構築しているタスクマネージャーです。フロントエンド（React）とバックエンド（Node.js + PostgreSQL）を組み合わせた実践的な学習プロジェクトとして運用しています。

## 📝 関連記事（Zenn連載）

このリポジトリの構築過程は、Zennの記事として公開しています。

- 前編（バックエンド構築編）：[20年目のフロントエンドエンジニアがNode.js+PostgreSQLでバックエンドの基礎をイチから構築してみた](https://zenn.dev/goiyu/articles/b6ca3c54b3851e)
- 後編（フロントエンド結合編）：[20年目のフロントエンドエンジニアが自作APIとReactを結合して気づいた「境界線」の壁](https://zenn.dev/goiyu/articles/c246169e21c718)

## 🛠️ 技術スタック

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS (v4)
- Lucide React (Icons)

### Backend

- Node.js
- Express
- PostgreSQL (生のSQLによるクエリ実行)
- pg (node-postgres)

## 📁 ディレクトリ構成

保守性を考慮し、フロントエンドとバックエンドを別々のディレクトリで管理しています。

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

`backend`ディレクトリ内に`.env`ファイルを作成し、PostgreSQLの接続情報を設定してください。

```bash
PORT=3000
DB_USER=your_postgres_user
DB_HOST=localhost
DB_NAME=task_manager_db
DB_PASSWORD=your_postgres_password
DB_PORT=5432
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

起動後、ブラウザで http://localhost:5173 にアクセスするとアプリが表示されます。

## 💡 今後の実装予定

学習を進めながら、以下の機能を順次追加していく予定です。

- 複数のユーザー管理
- 複数のプロジェクト管理
- プロジェクトへのアクセス権限
- ログイン機能（認証・認可）

## 🤝 著者
[goiyu](https://github.com/goi-yuta)
