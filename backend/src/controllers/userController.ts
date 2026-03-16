import { Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcrypt';

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_manager_db',
  password: String(process.env.DB_PASSWORD || 'password123'),
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const userController = {
  // 自テナントに所属するユーザー一覧の取得（タスク担当者のプルダウン用などに使う）
  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;

    try {
      // password_hash がフロントに漏れるのを防ぐ
      const result = await pool.query(`
        SELECT id, name, email, created_at
        FROM users
        WHERE tenant_id = $1 ORDER BY id ASC
      `,[tenantId]);
      res.json({ users: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ユーザーの取得に失敗しました' });
    }
  },

  // 新規追加：同じテナントに新しいメンバーを招待（作成）する
  async inviteUser(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: '名前、メールアドレス、初期パスワードは必須です' });
      return;
    }

    try {
      // メールアドレスの重複チェック
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
        return;
      }

      // 初期パスワードのハッシュ化
      const hashedPassword = await bcrypt.hash(password, 10);

      // ユーザーの作成
      const result = await pool.query(
        'INSERT INTO users (tenant_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, created_at',
        [tenantId, name, email, hashedPassword]
      );

      res.status(201).json({
        message: 'メンバーを招待しました',
        user: result.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'メンバーの招待に失敗しました' });
    }
  }
};
