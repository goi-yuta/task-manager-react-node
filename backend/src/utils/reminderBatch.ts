import { pool } from '../db';
import { sendMail } from './mailer';

export const sendDailyReminders = async () => {
  const client = await pool.connect();
  try {
    // JSON_AGG を使ってユーザーごとにタスクをまとめる
    const query = `
      SELECT
        t.tenant_id,
        u.email,
        u.name AS user_name,
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'due_date', TO_CHAR(t.due_date, 'YYYY-MM-DD')
          )
        ) AS tasks
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      WHERE t.status != 'DONE'
        AND t.deleted_at IS NULL
        AND t.due_date::date = CURRENT_DATE
        AND (t.last_reminded_at IS NULL OR t.last_reminded_at < CURRENT_DATE)
      GROUP BY t.tenant_id, u.email, u.name;
    `;

    const { rows } = await client.query(query);

    if (rows.length === 0) {
      console.log('✅ 本日リマインドが必要なタスクはありませんでした。');
      return;
    }

    console.log(`📢 ${rows.length}名のユーザーにまとめメールを送信します。`);

    for (const userRow of rows) {
      const { email, user_name, tasks } = userRow;
      const taskIds = tasks.map((t: any) => t.id); // 更新用にIDの配列を作成

      try {
        // HTMLのリストを作成
        const taskListHtml = tasks.map((t: any) =>
          `<li><strong>${t.title}</strong> (期限: ${t.due_date.replace(/-/g, '/')})</li>`
        ).join('');

        // At-least-once戦略: メール送信成功後にフラグを更新
        // 更新が失敗すると二重送信の可能性があるが、未送信よりは許容できる
        await sendMail({
          to: email,
          subject: `【重要】本日期限のタスクが ${tasks.length} 件あります`,
          text: `${user_name}様\n\nお疲れ様です。本日期限のタスクが ${tasks.length} 件あります。\n\n${tasks.map((t: any) =>
`・${t.title}`).join('\n')}`,
          html: `
            <p>${user_name}様</p>
            <p>お疲れ様です。<strong>本日中</strong>に期限を迎えるタスクが <strong>${tasks.length} 件</strong>あります。</p>
            <ul>
              ${taskListHtml}
            </ul>
            <p>ご確認をお願いします。</p>
          `
        });

        await client.query(
          'UPDATE tasks SET last_reminded_at = CURRENT_DATE WHERE id = ANY($1::int[])',
          [taskIds]
        );

        console.log(`✅ Sent digest reminder to ${email} for ${tasks.length} tasks.`);
      } catch (error) {
        console.error(`❌ Failed to send digest to ${email}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Reminder batch error:', error);
  } finally {
    client.release();
  }
};
