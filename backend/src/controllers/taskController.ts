import { Response } from 'express';
import { Pool, types } from 'pg';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/authMiddleware';
import { logActivity } from '../utils/activityLogger';
import { io } from '../index';

// PostgreSQLのDATE型(OID: 1082)はDateオブジェクトに自動変換せず、純粋な文字列のまま取得する設定
types.setTypeParser(1082, (stringValue) => stringValue);
// PostgreSQLのTIMESTAMP型 (OID: 1114) は「UTC」として扱い、Dateオブジェクトに変換してからフロントに返す
types.setTypeParser(1114, (stringValue) => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_manager_db',
  password: String(process.env.DB_PASSWORD || 'password123'),
  port: parseInt(process.env.DB_PORT || '5432'),
});

// JOINを含めた完全なタスク情報を取得するヘルパー
const fetchFullTask = async (taskId: number, tenantId: number) => {
  const result = await pool.query(`
    SELECT
       t.id, t.tenant_id, t.title, t.status, t.description,
       TO_CHAR(t.start_date, 'YYYY-MM-DD') AS start_date,
       TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
       t.project_id, t.assignee_id, t.created_by, t.created_at, t.deleted_at,
       u.name AS assignee_name, p.name AS project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1 AND t.tenant_id = $2
  `, [taskId, tenantId]);
  return result.rows[0];
};

export const taskController = {
  // タスク一覧の取得（自分が参加しているプロジェクトのタスクのみ）
  async getAllTasks(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    const { projectId, status, assigneeId, keyword } = req.query;

    try {
      let query = `
        SELECT
           t.id, t.tenant_id, t.title, t.status, t.description, t.start_date,
           TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
           t.project_id, t.assignee_id, t.created_by, t.created_at, t.deleted_at,
           u.name AS assignee_name, p.name AS project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        INNER JOIN project_members pm ON t.project_id = pm.project_id
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND pm.user_id = $2
      `;
      const values: any[] = [tenantId, userId];

      if (projectId) {
        values.push(projectId);
        query += ` AND t.project_id = $${values.length}`;
      }

      if (status) {
        values.push(status);
        query += ` AND t.status = $${values.length}`;
      }

      if (assigneeId) {
        if (assigneeId === 'me') {
          values.push(userId);
          query += ` AND t.assignee_id = $${values.length}`;
        } else if (assigneeId === 'unassigned') {
          query += ` AND t.assignee_id IS NULL`;
        } else {
          values.push(assigneeId);
          query += ` AND t.assignee_id = $${values.length}`;
        }
      }

      if (keyword && typeof keyword === 'string') {
        values.push(`%${keyword}%`);
        query += ` AND (t.title ILIKE $${values.length} OR t.description ILIKE $${values.length})`;
      }

      query += ` ORDER BY t.id ASC`; // 順序の保証

      const result = await pool.query(query, values);
      res.json({ tasks: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'タスクの取得に失敗しました' });
    }
  },

  // タスク単体の取得
  async getTask(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const taskId = req.params.id;

    try {
      // プロジェクトメンバーであることを確認しつつタスクを取得
      const result = await pool.query(`
        SELECT
           t.id, t.tenant_id, t.title, t.status, t.description,
           TO_CHAR(t.start_date, 'YYYY-MM-DD') AS start_date,
           TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
           t.project_id, t.assignee_id, t.created_by, t.created_at, t.deleted_at,
           u.name AS assignee_name, p.name AS project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        INNER JOIN project_members pm ON t.project_id = pm.project_id
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL AND pm.user_id = $3
      `, [taskId, tenantId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }

      res.json({ task: result.rows[0] });
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id, tenant_id, title, status, description, start_date,
           TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
           project_id, assignee_id, created_by, created_at, deleted_at`,
        [tenantId, title, 'TODO', project_id, assignee_id || null, start_date || null, due_date || null, description || null, userId]
      );

      const tempTask = result.rows[0];

      // JOINを含めた完全なタスク情報を再取得
      const newTask = await fetchFullTask(tempTask.id, tenantId!);

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      io.to(`project_${newTask.project_id}`).emit('task:created', {
        task: newTask,
        senderId: userId
      });

      if (tenantId && userId) {
        await logActivity(
          pool,
          tenantId,
          newTask.project_id,
          newTask.id,
          userId,
          'TASK_CREATED',
          { title: newTask.title }
        );
      }

      res.status(201).json(newTask);
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
      const oldTaskRes = await pool.query(
        `SELECT status, title, assignee_id, description,
          TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
          TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
         FROM tasks WHERE id = $1 AND tenant_id = $2`,
        [taskId, tenantId]
      );
      const oldTask = oldTaskRes.rows[0];

      const query = `
        UPDATE tasks
        SET ${updates.join(', ')}
        FROM project_members pm
        WHERE tasks.id = $${values.length + 1} AND tasks.tenant_id = $${values.length + 2}
          AND tasks.project_id = pm.project_id
          AND pm.user_id = $${values.length + 3}
          AND pm.role IN ('Owner', 'Editor')
          AND tasks.deleted_at IS NULL
        RETURNING
           tasks.id, tasks.tenant_id, tasks.title, tasks.status, tasks.description, tasks.start_date,
           TO_CHAR(tasks.due_date, 'YYYY-MM-DD') AS due_date,
           tasks.project_id, tasks.assignee_id, tasks.created_by, tasks.created_at, tasks.deleted_at`;

      const result = await pool.query(query, [...values, taskId, tenantId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }

      const tempUpdatedTask = result.rows[0];

      // JOINを含めた完全なタスク情報を再取得
      const updatedTask = await fetchFullTask(tempUpdatedTask.id, tenantId!);

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      io.to(`project_${updatedTask.project_id}`).emit('task:updated', {
        task: updatedTask,
        senderId: userId
      });

      if (oldTask && tenantId && userId) {
        const changes: Record<string, { old: any; new: any }> = {};

        allowedFields.forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(body, field)) {
            const oldVal = oldTask[field];
            const newVal = body[field];

            // 簡易比較：値が変わっていれば changes オブジェクトに差分を詰める
            if (String(oldVal || '') !== String(newVal || '')) {
              changes[field] = { old: oldVal, new: newVal };
            }
          }
        });

        // 実際に差分があった場合のみ、activity_logsにINSERT
        if (Object.keys(changes).length > 0) {
          // assignee_id が変わっていた場合、IDだけでなく担当者名も記録する
          // assignee_id が変わっていた場合、表示用の担当者名を changes とは別に記録する
          let assigneeName: { old: string | null; new: string | null } | undefined;
          if (changes.assignee_id) {
            const assigneeIds = [changes.assignee_id.old, changes.assignee_id.new].filter((id) => id != null);
            const nameMap: Record<number, string> = {};
            if (assigneeIds.length > 0) {
              const usersRes = await pool.query(
                `SELECT id, name FROM users WHERE id = ANY($1) AND tenant_id = $2`,
                [assigneeIds, tenantId]
              );
              usersRes.rows.forEach((row) => { nameMap[row.id] = row.name; });
            }
            assigneeName = {
              old: changes.assignee_id.old != null ? (nameMap[changes.assignee_id.old] ?? '不明') : null,
              new: changes.assignee_id.new != null ? (nameMap[changes.assignee_id.new] ?? '不明') : null,
            };
          }

          await logActivity(
            pool,
            tenantId,
            updatedTask.project_id,
            Number(taskId),
            userId,
            'TASK_UPDATED',
            { changes, ...(assigneeName && { assignee_name: assigneeName }) }
          );
        }
      }

      res.json(updatedTask);
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
         RETURNING tasks.id, tasks.project_id`,
        [taskId, tenantId, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'タスクが見つからないか、権限がありません' });
        return;
      }

      const deletedTaskInfo = result.rows[0];
      const projectId = deletedTaskInfo.project_id;

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      io.to(`project_${projectId}`).emit('task:deleted', {
        taskId: Number(taskId),
        senderId: userId
      });

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
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3 AND t.deleted_at IS NULL`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0) {
        res.status(403).json({ error: 'アクセス権限がないか、タスクが削除されています' });
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
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3 AND t.deleted_at IS NULL`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0 || accessCheck.rows[0].role === 'Viewer') {
        res.status(403).json({ error: 'コメントを投稿する権限がないか、タスクが削除されています' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO task_comments (task_id, user_id, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [taskId, userId, content]
      );

      const newCommentId = result.rows[0].id;

      // 投稿者名を含めた完全なコメント情報を取得
      const fullCommentRes = await pool.query(
        `SELECT tc.id, tc.task_id, tc.content, tc.created_at, u.name as user_name
         FROM task_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.id = $1`,
        [newCommentId]
      );
      const newComment = fullCommentRes.rows[0];

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      const taskResForRoom = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [newComment.task_id]);
      const commentProjectId = taskResForRoom.rows[0]?.project_id;
      if (commentProjectId) {
        io.to(`project_${commentProjectId}`).emit('comment:added', {
          comment: newComment,
          senderId: userId
        });
      }

      const taskRow = await pool.query(`SELECT project_id FROM tasks WHERE id = $1 AND tenant_id = $2`, [taskId, tenantId]);
      if (tenantId && userId && taskRow.rows[0]) {
        // HTMLタグを除去してコメント冒頭50文字をプレビューとして保存
        const plainText = content.replace(/<[^>]*>/g, '').trim();
        const preview = plainText.slice(0, 50);
        await logActivity(pool, tenantId, taskRow.rows[0].project_id, Number(taskId), userId, 'COMMENT_ADDED', { preview });
      }

      res.status(201).json({ message: 'コメントを追加しました', comment: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'コメントの追加に失敗しました' });
    }
  },

  // 添付ファイル一覧を取得
  async getAttachments(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.id;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    try {
      const accessCheck = await pool.query(
        `SELECT pm.role FROM tasks t
         INNER JOIN project_members pm ON t.project_id = pm.project_id
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3 AND t.deleted_at IS NULL`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0) {
        res.status(403).json({ error: 'アクセス権限がありません' });
        return;
      }

      const result = await pool.query(
        `SELECT id, original_name, file_path, file_type, file_size, created_at
         FROM task_attachments
         WHERE task_id = $1
         ORDER BY created_at DESC`,
        [taskId]
      );
      res.json({ attachments: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '添付ファイルの取得に失敗しました' });
    }
  },

  // 添付ファイルのアップロード
  async uploadAttachment(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.id;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'ファイルがアップロードされていません' });
      return;
    }

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const filePath = `/uploads/${file.filename}`;
    const fileMimeType = file.mimetype;
    const fileSize = file.size;

    try {
      const accessCheck = await pool.query(
        `SELECT pm.role FROM tasks t
         INNER JOIN project_members pm ON t.project_id = pm.project_id
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3 AND t.deleted_at IS NULL`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0 || accessCheck.rows[0].role === 'Viewer') {
        res.status(403).json({ error: 'ファイルを添付する権限がありません' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO task_attachments (task_id, user_id, original_name, file_path, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [taskId, userId, originalName, filePath, fileMimeType, fileSize]
      );

      const newAttachment = result.rows[0];

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      const attachmentTaskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [newAttachment.task_id]);
      const attachmentProjectId = attachmentTaskRes.rows[0]?.project_id;
      if (attachmentProjectId) {
        io.to(`project_${attachmentProjectId}`).emit('attachment:uploaded', {
          attachment: newAttachment,
          senderId: userId
        });
      }

      const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
      const projectId = taskRes.rows[0]?.project_id;

      if (tenantId && projectId && userId) {
        await logActivity(
          pool,
          tenantId,
          projectId,
          Number(taskId),
          userId,
          'FILE_ATTACHED',
          { file_name: file.originalname } // JSONBで元のファイル名を記録
        );
      }

      res.status(201).json({ message: 'ファイルを添付しました', attachment: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ファイルの添付に失敗しました' });
    }
  },

  // 添付ファイルの削除（DBとディスクの両方から削除）
  async deleteAttachment(req: AuthRequest, res: Response): Promise<void> {
    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    try {
      const accessCheck = await pool.query(
        `SELECT pm.role FROM tasks t
         INNER JOIN project_members pm ON t.project_id = pm.project_id
         WHERE t.id = $1 AND t.tenant_id = $2 AND pm.user_id = $3 AND t.deleted_at IS NULL`,
        [taskId, tenantId, userId]
      );

      if (accessCheck.rows.length === 0 || accessCheck.rows[0].role === 'Viewer') {
        res.status(403).json({ error: 'ファイルを削除する権限がありません' });
        return;
      }

      // DBからファイル情報を取得
      const attachment = await pool.query(
        'SELECT file_path, original_name FROM task_attachments WHERE id = $1 AND task_id = $2',
        [attachmentId, taskId]
      );

      if (attachment.rows.length === 0) {
        res.status(404).json({ error: 'ファイルが見つかりません' });
        return;
      }

      // サーバーのディスクから削除
      const absolutePath = path.join(__dirname, '../..', attachment.rows[0].file_path);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      // DBから削除
      await pool.query('DELETE FROM task_attachments WHERE id = $1', [attachmentId]);

      // WebSocket通知: 同じプロジェクトのメンバーにのみ通知
      const deleteAttachmentTaskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
      const deleteAttachmentProjectId = deleteAttachmentTaskRes.rows[0]?.project_id;
      if (deleteAttachmentProjectId) {
        io.to(`project_${deleteAttachmentProjectId}`).emit('attachment:deleted', {
          taskId: Number(taskId),
          attachmentId: Number(attachmentId),
          senderId: userId
        });
      }

      const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
      if (tenantId && userId && taskRes.rows[0]) {
        await logActivity(
          pool,
          tenantId,
          taskRes.rows[0].project_id,
          Number(taskId),
          userId,
          'FILE_DELETED',
          { file_name: attachment.rows[0].original_name }
        );
      }

      res.json({ message: 'ファイルを削除しました' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ファイルの削除に失敗しました' });
    }
  },

  // タスクのアクティビティログを取得
  async getTaskActivityLogs(req: AuthRequest, res: Response): Promise<void> {
    const tenantId = req.user?.tenantId;
    const taskId = req.params.id;

    try {
      // LEFT JOIN を使って「誰が操作したか」の名前も一緒に取ってくる
      const query = `
        SELECT
          al.id,
          al.action,
          al.details,
          al.created_at,
          u.id AS user_id,
          u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.task_id = $1 AND al.tenant_id = $2
        ORDER BY al.created_at DESC
      `;

      const result = await pool.query(query, [taskId, tenantId]);

      res.json(result.rows);
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err);
      res.status(500).json({ error: 'アクティビティログの取得に失敗しました' });
    }
  }
};
