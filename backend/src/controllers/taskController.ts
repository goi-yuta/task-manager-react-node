import { Request, Response } from 'express';
import { pool } from '../db';

// タスク一覧取得の処理
export const getAllTasks = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        tasks.id,
        tasks.title,
        tasks.status,
        projects.name AS project_name,
        users.name AS assignee_name
      FROM tasks
      LEFT JOIN projects ON tasks.project_id = projects.id
      LEFT JOIN users ON tasks.assignee_id = users.id
      WHERE tasks.deleted_at IS NULL;
    `;
    const result = await pool.query(query);

    res.status(200).json({
      message: 'タスク一覧を取得しました',
      tasks: result.rows
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};

// タスク作成 (POST)
export const createTask = async (req: Request, res: Response) => {
  const { title, due_date, project_id, assignee_id } = req.body;

  if (!title || !project_id) {
    return res.status(400).json({ error: 'タイトルとプロジェクトIDは必須です' });
  }

  try {
    const query = `
      INSERT INTO tasks (title, due_date, project_id, assignee_id, created_by)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [title, due_date, project_id, assignee_id]);
    res.status(201).json({ message: 'タスクを作成しました', task: result.rows[0] });
  } catch (err: any) {
    console.error('Error creating task:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: '指定されたプロジェクトまたはユーザーが存在しません' });
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};

// タスク更新 (PUT)
export const updateTaskStatus = async (req: Request, res: Response) => {
  const taskId = req.params.taskId;
  const { status } = req.body;

  const validStatuses = ['TODO', 'DOING', 'DONE'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: '無効なステータスです' });
  }

  try {
    const query = `
      UPDATE tasks
      SET status = $1
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await pool.query(query, [status, taskId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }
    res.status(200).json({ message: 'ステータスを更新しました', task: result.rows[0] });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};

// タスク論理削除 (DELETE)
export const deleteTask = async (req: Request, res: Response) => {
  const taskId = req.params.taskId;

  try {
    const query = `
      UPDATE tasks
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const result = await pool.query(query, [taskId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'タスクが見つからないか、既に削除されています' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};

// // タスク物理削除 (DELETE)
// export const deleteTask = async (req: Request, res: Response) => {
//   const taskId = req.params.taskId;

//   try {
//     // DELETE文：指定したIDのタスクを削除する
//     const query = `
//       DELETE FROM tasks
//       WHERE id = $1;
//     `;

//     const result = await pool.query(query, [taskId]);

//     // 削除対象のタスクが存在しなかった場合
//     if (result.rowCount === 0) {
//       return res.status(404).json({ error: '指定されたタスクが見つかりません' });
//     }

//     // 削除成功時は 204 No Content を返すのが一般的です
//     res.status(204).send();

//   } catch (err) {
//     console.error('Error deleting task:', err);
//     res.status(500).json({ error: 'サーバーエラーが発生しました' });
//   }
// });
