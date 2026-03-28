import { Response } from 'express';
import { Pool, types } from 'pg';
import { AuthRequest } from '../middleware/authMiddleware';

// PostgreSQLのDATE型(OID: 1082)とTIMESTAMP型(OID: 1114)をDateオブジェクトに自動変換せず、純粋な文字列のまま取得する設定
types.setTypeParser(1082, (stringValue) => stringValue);
types.setTypeParser(1114, (stringValue) => stringValue);

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
    const { title, project_id, assignee_id, start_date, due_date, description } = req.body;

    if (!title || !project_id) {
      res.status(400).json({ error: 'タイトルとプロジェクトIDは必須です' });
      return;
    }

    if (start_date && due_date && start_date > due_date) {
      res.status(400).json({ error: '開始日は期限日より前（または同じ日）を指定してください' });
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
        `INSERT INTO tasks (tenant_id, title, status, project_id, assignee_id, start_date, due_date, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [tenantId, title, 'TODO', project_id, assignee_id || null, start_date || null, due_date || null, description || null, userId]
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
    const body = req.body;

    if (body.start_date && body.due_date && body.start_date > body.due_date) {
      res.status(400).json({ error: '開始日は期限日より前（または同じ日）を指定してください' });
      return;
    }

    const allowedFields = ['status', 'title', 'start_date', 'due_date', 'assignee_id', 'description'];
    const updates: string[] = [];
    const values: any[] = [];

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates.push(`${field} = $${values.length + 1}`);
        values.push(body[field]);
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: '更新する項目がありません' });
      return;
    }

    try {
      const query = `
        UPDATE tasks
        SET ${updates.join(', ')}
        FROM project_members pm
        WHERE tasks.id = $${values.length + 1} AND tasks.tenant_id = $${values.length + 2}
          AND tasks.project_id = pm.project_id
          AND pm.user_id = $${values.length + 3}
          AND pm.role IN ('Owner', 'Editor')
          AND tasks.deleted_at IS NULL
        RETURNING tasks.*`;

      const result = await pool.query(query, [...values, taskId, tenantId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23514') {
        res.status(400).json({ error: '開始日は期限日より前（または同じ日）を指定してください' });
        return;
      }
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
  },

  // コメント一覧の取得
  async getComments(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.id;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    try {
      // 自分がこのタスクの属するプロジェクトのメンバーかチェック
      const accessCheck = await pool.query(
        `SELECT pm.role FROM tasks t
         INNER JOIN project_members pm ON t.project_id = pm.project_id
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0) {
        res.status(403).json({ error: 'アクセス権限がありません' });
        return;
      }

      // コメントと投稿者の名前を結合して取得
      const result = await pool.query(
        `SELECT tc.id, tc.content, tc.created_at, u.name as user_name
         FROM task_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.task_id = $1
         ORDER BY tc.created_at ASC`,
        [taskId]
      );
      res.json({ comments: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'コメントの取得に失敗しました' });
    }
  },

  // コメントの追加
  async addComment(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.id;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'コメント内容が必要です' });
      return;
    }

    try {
      // Viewer権限はコメントできないようにチェック
      const accessCheck = await pool.query(
        `SELECT pm.role FROM tasks t
         INNER JOIN project_members pm ON t.project_id = pm.project_id
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0 || accessCheck.rows[0].role === 'Viewer') {
        res.status(403).json({ error: 'コメントを投稿する権限がありません' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO task_comments (task_id, user_id, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [taskId, userId, content]
      );
      res.status(201).json({ message: 'コメントを追加しました', comment: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'コメントの追加に失敗しました' });
    }
  }
};
