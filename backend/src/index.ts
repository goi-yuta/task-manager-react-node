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

  console.log(`User connected: ID ${user.userId} (Tenant: ${user.tenantId})`);

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
      const projectRoom = `project_${row.project_id}`;
      socket.join(projectRoom);
      // console.log(`User ${user.userId} joined room: ${projectRoom}`);
    });
  } catch (err) {
    console.error('Error joining project rooms:', err);
  }

  socket.on('disconnect', () => {
    console.log(`User disconnected: ID ${user.userId}`);
  });
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

// ルーティングの設定
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
