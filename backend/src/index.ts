import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import projectRoutes from './routes/projectRoutes';
import { pool } from './db';
import jwt from 'jsonwebtoken';
import { sendMail } from './utils/mailer';
import cron from 'node-cron';
import { sendDailyReminders } from './utils/reminderBatch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Socket.ioの初期化
export const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// CORSの許可
app.use(cors({
  origin: 'http://localhost:5173',
}));

// JSONボディをパースするミドルウェア
app.use(express.json());

// Socket.ioの認証ミドルウェアと接続ハンドリング
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error'));
    (socket as any).user = decoded;
    next();
  });
});

io.on('connection', async (socket) => {
  const user = (socket as any).user;
  const tenantRoom = `tenant_${user.tenantId}`;
  const userRoom = `user_${user.userId}`;

  // 基本のテナントルームと個人ルームに参加
  socket.join(tenantRoom);
  socket.join(userRoom);

  // 所属しているプロジェクトのルームにすべて参加させる
  try {
    const projectMembers = await pool.query(
      'SELECT project_id FROM project_members WHERE user_id = $1',
      [user.userId]
    );
    projectMembers.rows.forEach((row: any) => {
      socket.join(`project_${row.project_id}`);
    });
  } catch (err) {
    console.error('Error joining project rooms:', err);
  }

  // プロジェクトルームの動的参加・離脱
  socket.on('join:project', (projectId: number) => {
    socket.join(`project_${projectId}`);
  });

  socket.on('leave:project', (projectId: number) => {
    socket.leave(`project_${projectId}`);
  });

  socket.on('disconnect', () => {
    // クライアント切断時は全ルームから自動離脱される
  });
});

// 毎日午前9:00に実行 (テスト時は '*/1 * * * *' などで1分毎に設定して確認できる)
cron.schedule('0 9 * * *', () => {
  console.log('⏰ 期限リマインドバッチを開始します...');
  sendDailyReminders();
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.send('Hello Backend World!');
});

// DB接続テスト用エンドポイント
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
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

app.get('/test-email', async (req, res) => {
  try {
    await sendMail({
      to: 'test@example.com',
      subject: 'テストメール送信（Task Manager）',
      text: 'これはメール送信機能のテストです。Mailtrapに届いていれば成功です！',
      html: '<strong>これはメール送信機能のテストです。</strong><p>Mailtrapに届いていれば成功です！</p>',
    });
    res.json({ status: 'OK', message: 'Test email sent successfully' });
  } catch (error) {
    // ログを出力しつつ、フロントエンドには簡潔なエラーを返す
    console.error('Test email error:', error);
    res.status(500).json({ status: 'Error', message: 'Failed to send test email' });
  }
});

// ルーティングの設定
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
