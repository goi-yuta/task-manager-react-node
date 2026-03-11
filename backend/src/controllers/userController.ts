import { Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from '../middleware/authMiddleware';

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
  }
};
