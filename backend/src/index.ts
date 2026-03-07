import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import taskRoutes from './routes/taskRoutes';
import { pool } from './db';

dotenv.config();

const app = express();
const port = 3000;

// JSONボディをパースするミドルウェア
app.use(express.json());

// ルートエンドポイント
app.get('/', (req, res) => {
  res.send('Hello Backend World!');
});

// DB接続テスト用エンドポイント
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()'); // 現在時刻を取得するSQL
    client.release(); // 接続をプールに戻す（重要！）
    res.json({
      status: 'OK',
      message: 'Database connection successful',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'Error', message: 'Database connection failed' });
  }
});

// タスク一覧取得エンドポイント (GET /tasks)
app.use('/tasks', taskRoutes);

// 特定のプロジェクトのタスク一覧を取得するエンドポイント
// :projectId の部分が動的に変わる「パスパラメータ」です
app.get('/projects/:projectId/tasks', async (req, res) => {
  // URLから projectId を取得する
  const projectId = req.params.projectId;

  try {
    // WHERE を使って特定のプロジェクトIDで絞り込むSQL
    const query = `
      SELECT
        tasks.id,
        tasks.title,
        tasks.status,
        users.name AS assignee_name
      FROM tasks
      LEFT JOIN users ON tasks.assignee_id = users.id
      WHERE tasks.project_id = $1 AND tasks.deleted_at IS NULL;
    `;

    // $1 の部分に projectId を安全に埋め込む
    const result = await pool.query(query, [projectId]);

    res.status(200).json({
      message: `プロジェクトID: ${projectId} のタスク一覧を取得しました`,
      tasks: result.rows
    });

  } catch (err) {
    console.error('Error fetching project tasks:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ユーザー登録エンドポイント (POST /users)
app.post('/users', async (req, res) => {
  const { name, email, password } = req.body;

  // 簡単なバリデーション
  if (!name || !email || !password) {
    return res.status(400).json({ error: '名前、メールアドレス、パスワードは必須です' });
  }

  try {
    // 1. パスワードのハッシュ化（ソルトラウンドは10が標準的）
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. データベースへの保存
    // $1, $2 などの「プレースホルダー」を使うことで、SQLインジェクション攻撃を防ぎます
    const query = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at;
    `;
    const values = [name, email, hashedPassword];

    const result = await pool.query(query, values);

    // 3. 成功レスポンスを返す（パスワードのハッシュ値は返さないのがマナー）
    const newUser = result.rows[0];
    res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user: newUser
    });

  } catch (err: any) {
    console.error('Error creating user:', err);
    // メールアドレスの重複エラー（PostgreSQLのエラーコード 23505）
    if (err.code === '23505') {
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プロジェクト作成エンドポイント (POST /projects)
app.post('/projects', async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'プロジェクト名は必須です' });
  }

  try {
    const query = `
      INSERT INTO projects (name, description)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, description]);
    res.status(201).json({ message: 'プロジェクトを作成しました', project: result.rows[0] });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
