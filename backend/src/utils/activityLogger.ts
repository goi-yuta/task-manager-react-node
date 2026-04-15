import { Pool } from 'pg';

/**
 * アクティビティログをDBに記録する汎用関数
 */
export const logActivity = async (
  pool: Pool,
  tenantId: number,
  projectId: number,
  taskId: number | null,
  userId: number | null,
  action: string,
  details: object = {}
) => {
  try {
    const query = `
      INSERT INTO activity_logs (tenant_id, project_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [tenantId, projectId, taskId, userId, action, details]);
  } catch (error) {
    // ログの保存に失敗しても、メインの処理（タスク更新など）は止めないようにエラーをキャッチだけしておく
    console.error('Failed to log activity:', error);
  }
};
