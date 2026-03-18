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
  // タスク一覧の取得（自分が参加しているプロジェクトのタスクのみ）
  async getAllTasks(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const projectId = req.query.projectId;
    const userId = req.user?.userId;

    try {
      let query = `
        SELECT t.*, u.name AS assignee_name, p.name AS project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        INNER JOIN project_members pm ON t.project_id = pm.project_id
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND pm.user_id = $2
      `;
      const values: any[] = [tenantId, userId];

      if (projectId) {
        values.push(projectId);
        query += ` AND t.project_id = $3`;
      }

      query += ` ORDER BY t.id ASC`; // 順序の保証

      const result = await pool.query(query, values);
      res.json({ tasks: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの取得に失敗しました' });
    }
  },

  // タスクの作成（Owner または Editor のみ可能）
  async createTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const { title, project_id, assignee_id, due_date } = req.body;

    if (!title || !project_id) {
      res.status(400).json({ error: 'タイトルとプロジェクトIDは必須です' });
      return;
    }

    try {
      // 1. まず、自分がこのプロジェクトに対して十分な権限を持っているかチェック
      const memberCheck = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [project_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        res.status(403).json({ error: 'このプロジェクトにアクセスする権限がありません' });
        return;
      }

      const role = memberCheck.rows[0].role;
      if (role !== 'Owner' && role !== 'Editor') {
        res.status(403).json({ error: 'タスクを作成する権限がありません（Viewer権限です）' });
      }

      const result = await pool.query(
        `INSERT INTO tasks (tenant_id, title, status, project_id, assignee_id, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, title, 'TODO', project_id, assignee_id || null, due_date || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの作成に失敗しました' });
    }
  },

  // タスクの更新（Owner または Editor のみ可能）
  async updateTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const taskId = req.params.id;
    const { status, title, due_date, assignee_id } = req.body;

    try {
      const result = await pool.query(
        `UPDATE tasks
         SET status = COALESCE($1, tasks.status),
             title = COALESCE($2, tasks.title),
             due_date = COALESCE($3, tasks.due_date),
             assignee_id = COALESCE($4, tasks.assignee_id)
         FROM project_members pm
         WHERE tasks.id = $5 AND tasks.tenant_id = $6
           AND tasks.project_id = pm.project_id
           AND pm.user_id = $7
           AND pm.role IN ('Owner', 'Editor')
           AND tasks.deleted_at IS NULL
         RETURNING tasks.*`,
        [status, title, due_date, assignee_id, taskId, tenantId, userId]
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

  // タスクの削除（論理削除）（Owner または Editor のみ可能）
  async deleteTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const taskId = req.params.id;

    try {
      const result = await pool.query(
        `UPDATE tasks
         SET deleted_at = CURRENT_TIMESTAMP
         FROM project_members pm
         WHERE tasks.id = $1 AND tasks.tenant_id = $2
           AND tasks.project_id = pm.project_id
           AND pm.user_id = $3
           AND pm.role IN ('Owner', 'Editor')
           AND tasks.deleted_at IS NULL
         RETURNING tasks.id`,
        [taskId, tenantId, userId]
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
