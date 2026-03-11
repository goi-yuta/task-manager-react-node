import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import projectRoutes from './routes/projectRoutes';
import { pool } from './db';

dotenv.config();

const app = express();
const port = 3000;

// CORSの許可
app.use(cors({
  origin: 'http://localhost:5173', // フロントエンドのURL（住所）だけを特別に許可
}));

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

// ルーティングの設定
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
