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
  [401エラーの正体とマルチテナントの泥臭い裏側。20年目のフロントエンジニアがSaaSを自作して得た気づき](https://zenn.dev/goiyu/articles/34c552e584ba41)
* **第4回（メンバー招待・リファクタリング編）**：  
  [いるはずのない「tanakaさん」の罠とloadingの細分化。20年目がメンバー招待APIを自作して気づいたSaaSの裏側](https://zenn.dev/goiyu/articles/6909dd8f6c06b3)
* **第5回（アクセス権限・UI制御編）**：  
  [フロントは配慮、バックは砦。「エイリアスの罠」にハマった20年目が挑むSaaSのアクセス権限](https://zenn.dev/goiyu/articles/e4220968a5cdd8)
* **第6回（ガントチャート・ドラッグ＆ドロップ編）**：  
  [「1日ズレる呪い」とCSS Grid。20年目のフロントエンジニアがライブラリなしで作り上げたガントチャート](https://zenn.dev/goiyu/articles/fcca1d450abfe9)
* **第7回（リッチテキスト・メンション機能編）**：  
  [「古い記憶の罠」と再描画の壁。20年目のフロントエンジニアがTiptapでSaaSのメンション機能を自作して得た気づき](https://zenn.dev/goiyu/articles/ea72e6d8484614)
* **第8回（フィルタリング・ファイル添付編）**：  
  [Content-Typeの罠とundefinedの恐怖。ファイル添付APIを自作して思い知った「フルスタックの壁」](https://zenn.dev/goiyu/articles/5022efe4378804)
* **第9回（アクティビティログ編）**：  
  [「変わってないのに変わった」の罠とJSONBの設計。20年目のフロントエンジニアがSaaSのアクティビティログを自作して思い知った監査設計](https://zenn.dev/goiyu/articles/f76c3757f7018c)
* **第10回（リアルタイム同期（WebSocket）とアプリ内通知編）**：  
  [「誰かが変えた」を即座に反映する。20年目のフロントエンジニアがSocket.IOでリアルタイム同期と通知機能を自作して得た設計の学び](https://zenn.dev/goiyu/articles/3f7124cdfea772)
* **第11回（メール通知 ＆ 定期バッチ処理編）**：  
  [Fire-and-ForgetとAt-least-once。20年目のフロントエンジニアがメール通知で学んだ設計パターン](https://zenn.dev/goiyu/articles/0e1e4c8076c5ec)


## 🛠️ 技術スタック

**Frontend**

* [React 19](https://react.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vite.dev/)
* [Tailwind CSS (v4)](https://tailwindcss.com/)
* [Lucide React](https://lucide.dev/) (Icons)
* [Tiptap](https://tiptap.dev/) (Rich Text Editor)
* [DOMPurify](https://github.com/cure53/DOMPurify) (XSS Sanitization)
* [Socket.IO Client](https://socket.io/)（リアルタイム通信）

**Backend**

* [Node.js](https://nodejs.org/ja)
* [Express](https://expressjs.com/)
* [PostgreSQL](https://www.postgresql.org/) (生のSQLによるクエリ実行)
* [pg (node-postgres)](https://node-postgres.com/)
* [bcrypt](https://github.com/kelektiv/node.bcrypt.js) (パスワードハッシュ化)
* [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) (JWT認証)
* [Socket.IO](https://socket.io/)（WebSocketサーバー）
* [Nodemailer](https://nodemailer.com/)（メール送信）
* [node-cron](https://github.com/node-cron/node-cron)（定期バッチ処理）

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
- [x] タスク詳細のリッチテキスト（WYSIWYG）対応
- [x] コメント＆メンション機能
- [x] 高度なフィルタリング
- [x] 画像やファイルの添付機能
- [x] アクティビティログ
- [x] WebSocketを利用したリアルタイム同期・アプリ内通知
- [x] メール通知 ＆ 定期バッチ処理
- [ ] **CSVでの一括インポート / エクスポート（次のターゲット）**
- [ ] PostgreSQLのフルテキスト検索機能

## 🤝 著者
[goiyu](https://github.com/goi-yuta)
