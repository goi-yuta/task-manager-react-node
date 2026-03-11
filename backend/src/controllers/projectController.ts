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

export const projectController = {
  // プロジェクト一覧の取得（自テナントのもののみ）
  async getAllProjects(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    try {
      const result = await pool.query(`
        SELECT *
        FROM projects
        WHERE tenant_id = $1 ORDER BY id ASC
      `,[tenantId]);
      res.json({ projects: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
    }
  },

  // プロジェクトの作成
  async createProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'プロジェクト名は必須です' });
      return;
    }

    try {
      const result = await pool.query(
        'INSERT INTO projects (tenant_id, created_by, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [tenantId, userId, name, description || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの作成に失敗しました' });
    }
  },

  // プロジェクトの更新
  async updateProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const projectId = req.params.id;
    const { name, description } = req.body;

    try {
      const result = await pool.query(
        `UPDATE projects
         SET name = COALESCE($1, name),
             description = COALESCE($2, description)
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [name, description, projectId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'プロジェクトが見つからないか、権限がありません' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの更新に失敗しました' });
    }
  },

  // プロジェクトの削除
  async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const projectId = req.params.id;

    try {
      const result = await pool.query(
        'DELETE FROM projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [projectId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'プロジェクトが見つからないか、権限がありません' });
        return;
      }
      res.json({ message: 'プロジェクトを削除しました', id: projectId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'プロジェクトの削除に失敗しました' });
    }
  }
};
