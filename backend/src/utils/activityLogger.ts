import { Pool } from 'pg';
import { io } from '../index';
import { sendMail } from './mailer';

interface ActivityDetails {
  changes?: Record<string, { old: any; new: any }>;
  assignee_name?: { old: string | null; new: string | null };
  mentionedUserIds?: number[];
  task_title?: string;
  preview?: string;
  [key: string]: any;
}

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

export const logActivity = async (
  pool: Pool,
  tenantId: number,
  projectId: number,
  taskId: number | null,
  userId: number | null,
  action: string,
  details: ActivityDetails = {}
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

    // 4. 通知対象者のメールアドレスと名前をDBから取得
    const targetUserIds = insertedRes.rows.map(r => r.user_id);
    if (targetUserIds.length > 0) {
      const usersRes = await pool.query(
        `SELECT id, email, name FROM users WHERE id = ANY($1::int[])`,
        [targetUserIds]
      );
      const userMap = new Map(usersRes.rows.map(u => [u.id, u]));

      // アクションに応じたメール送信判定
      for (const row of insertedRes.rows) {
        const targetUser = userMap.get(row.user_id);
        if (!targetUser) continue;

        // 担当者に指名された場合 (TASK_UPDATED かつ assignee_id の変更)
        if (action === 'TASK_UPDATED' && details.changes?.assignee_id) {
          const newAssigneeId = details.changes.assignee_id.new;
          if (targetUser.id === newAssigneeId) {
            sendMail({
              to: targetUser.email,
              subject: `【アサイン】タスクの担当者に指名されました`,
              text: `${targetUser.name}様\n\nお疲れ様です。以下のタスクの担当者に指名されました。\n\nタスク名: ${details.task_title || '不明'}\n\n確認をお願いします。`,
              html: `<p>${targetUser.name}様</p><p>お疲れ様です。以下のタスクの<strong>担当者に指名されました。</strong></p><p><strong>タスク名:</strong>${details.task_title || '不明'}</p>`
            }).catch(err => console.error('❌ Failed to send assignment email:', err));
          }
        }

        // メンションされた場合 (後述の addComment 側で mentionedUserIds を渡す想定)
        if (action === 'COMMENT_ADDED' && details.mentionedUserIds?.includes(targetUser.id)) {
          sendMail({
            to: targetUser.email,
            subject: `【メンション】コメントであなた宛のメッセージがあります`,
            text: `${targetUser.name}様\n\nお疲れ様です。コメントでメンションされました。\n\n内容: ${details.preview}...`,
            html: `<p>${targetUser.name}様</p><p>コメントで<strong>メンションされました。</strong></p><p><strong>タスク名:</strong>${details.task_title || '不明'}</p><blockquote>${details.preview}...</blockquote>`
          }).catch(err => console.error('❌ Failed to send mention email:', err));
        }
      }
    }

    // 5. 未読件数を一括取得
    const countsRes = await pool.query(
      `SELECT user_id, COUNT(*) as count
       FROM user_notifications
       WHERE user_id = ANY($1::int[]) AND is_read = FALSE
       GROUP BY user_id`,
      [targetUserIds]
    );
    const unreadMap = new Map(countsRes.rows.map((r: any) => [r.user_id, parseInt(r.count)]));

    // 6. 各ユーザーにWebSocket通知
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
