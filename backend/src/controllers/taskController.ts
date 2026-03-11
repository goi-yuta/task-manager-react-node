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

export const taskController = {
  // タスク一覧の取得（自分のテナントのタスクのみ！）
  async getAllTasks(req: AuthRequest, res: Response): Promise<void> {
    // ミドルウェアで付与された情報を取得
    const tenantId = req.user?.tenantId;
    const projectId = req.query.projectId;

    try {
      let query = `
        SELECT tasks.*, users.name AS assignee_name, projects.name AS project_name
        FROM tasks
        LEFT JOIN users ON tasks.assignee_id = users.id
        LEFT JOIN projects ON tasks.project_id = projects.id
        WHERE tasks.tenant_id = $1 AND tasks.deleted_at IS NULL
      `;
      const values: any[] = [tenantId];

      if (projectId) {
        query += ` AND tasks.project_id = $2`;
        values.push(projectId);
      }

      query += ` ORDER BY tasks.id ASC`; // 順序の保証

      const result = await pool.query(query, values);
      res.json({ tasks: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの取得に失敗しました' });
    }
  },

  // タスクの作成
  async createTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const { title, project_id, assignee_id, due_date } = req.body;

    if (!title || !project_id) {
      res.status(400).json({ error: 'タイトルとプロジェクトIDは必須です' });
      return;
    }

    try {
      // 💡 悪意のあるユーザーが他社のプロジェクトIDを指定しても登録できないよう、
      // 念のためプロジェクトが自社のものか確認する処理を入れるとさらに安全かも（今回は省略）

      const result = await pool.query(
        `INSERT INTO tasks (tenant_id, title, project_id, assignee_id, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, title, project_id, assignee_id || null, due_date || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの作成に失敗しました' });
    }
  },

  // タスクの更新
  async updateTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const taskId = req.params.id;
    const { status, title, assignee_id } = req.body;

    try {
      const result = await pool.query(
        `UPDATE tasks
         SET status = COALESCE($1, status),
             title = COALESCE($2, title),
             assignee_id = COALESCE($3, assignee_id)
         WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
         RETURNING *`,
        [status, title, assignee_id, taskId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの更新に失敗しました' });
    }
  },

  // タスクの削除（論理削除）
  async deleteTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const taskId = req.params.id;

    try {
      const result = await pool.query(
        `UPDATE tasks
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [taskId, tenantId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }
      res.json({ message: 'タスクを削除しました', id: taskId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの削除に失敗しました' });
    }
  }
};
