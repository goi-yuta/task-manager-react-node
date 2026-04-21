import { Pool } from 'pg';
import { io } from '../index';

/**
 * アクティビティログをDBに記録し、通知を生成する汎用関数
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
    // 1. アクティビティログの記録
    const query = `
      INSERT INTO activity_logs (tenant_id, project_id, task_id, user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const logRes = await pool.query(query, [tenantId, projectId, taskId, userId, action, details]);
    const activityLogId = logRes.rows[0].id;

    // 2. 通知の生成（自分以外のプロジェクトメンバー全員）
    const membersRes = await pool.query(
      'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id != $2',
      [projectId, userId || 0]
    );

    for (const member of membersRes.rows) {
      await pool.query(
        `INSERT INTO user_notifications (user_id, tenant_id, activity_log_id)
         VALUES ($1, $2, $3)`,
        [member.user_id, tenantId, activityLogId]
      );

      // 3. 詳細情報を取得してWebSocketで通知（個人ルーム user_{id} 宛）
      const notificationDetailsRes = await pool.query(`
        SELECT
          un.id, un.is_read, un.created_at,
          al.action, al.details,
          t.id as task_id, t.title as task_title, t.project_id,
          u.name as actor_name
        FROM user_notifications un
        JOIN activity_logs al ON un.activity_log_id = al.id
        JOIN tasks t ON al.task_id = t.id
        LEFT JOIN users u ON al.user_id = u.id
        WHERE un.id = (SELECT id FROM user_notifications WHERE user_id = $1 AND activity_log_id = $2 ORDER BY id DESC LIMIT 1)
      `, [member.user_id, activityLogId]);

      const notification = notificationDetailsRes.rows[0];

      // 未読件数を取得
      const countRes = await pool.query(
        'SELECT COUNT(*) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE',
        [member.user_id]
      );
      const unreadCount = parseInt(countRes.rows[0].count);

      io.to(`user_${member.user_id}`).emit('notification:new', {
        unreadCount,
        notification
      });
    }

  } catch (error) {
    // ログの保存に失敗しても、メインの処理（タスク更新など）は止めないようにエラーをキャッチだけしておく
    console.error('Failed to log activity or create notifications:', error);
  }
};
