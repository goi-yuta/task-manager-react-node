import { Pool } from 'pg';
import { io } from '../index';

/** 通知詳細を取得するための共通クエリ（WHERE句の前まで） */
export const NOTIFICATION_SELECT_QUERY = `
  SELECT
    un.id, un.user_id, un.is_read, un.created_at,
    al.action, al.details,
    t.id as task_id, t.title as task_title, t.project_id,
    u.name as actor_name
  FROM user_notifications un
  JOIN activity_logs al ON un.activity_log_id = al.id
  JOIN tasks t ON al.task_id = t.id
  LEFT JOIN users u ON al.user_id = u.id
`;

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

    // 2. 通知の一括生成（自分以外のプロジェクトメンバー全員）
    const insertedRes = await pool.query(
      `INSERT INTO user_notifications (user_id, tenant_id, activity_log_id)
       SELECT pm.user_id, $1, $2
       FROM project_members pm
       WHERE pm.project_id = $3 AND pm.user_id != $4
       RETURNING id, user_id`,
      [tenantId, activityLogId, projectId, userId || 0]
    );

    if (insertedRes.rows.length === 0) return;

    // 3. 通知詳細を一括取得
    const notificationIds = insertedRes.rows.map(r => r.id);
    const notificationsRes = await pool.query(
      `${NOTIFICATION_SELECT_QUERY} WHERE un.id = ANY($1::int[])`,
      [notificationIds]
    );

    // 4. 未読件数を一括取得
    const targetUserIds = insertedRes.rows.map(r => r.user_id);
    const countsRes = await pool.query(
      `SELECT user_id, COUNT(*) as count
       FROM user_notifications
       WHERE user_id = ANY($1::int[]) AND is_read = FALSE
       GROUP BY user_id`,
      [targetUserIds]
    );
    const unreadMap = new Map(countsRes.rows.map((r: any) => [r.user_id, parseInt(r.count)]));

    // 5. 各ユーザーにWebSocket通知
    for (const notification of notificationsRes.rows) {
      const unreadCount = unreadMap.get(notification.user_id) || 0;
      io.to(`user_${notification.user_id}`).emit('notification:new', {
        unreadCount,
        notification
      });
    }

  } catch (error) {
    // ログの保存に失敗しても、メインの処理（タスク更新など）は止めないようにエラーをキャッチだけしておく
    console.error('Failed to log activity or create notifications:', error);
  }
};
