import { TASK_STATUS_LABEL } from '../types';

/**
 * アクティビティログや通知のための表示用メッセージを生成する
 */
export const formatActivityMessage = (
  action: string,
  details: any,
  actorName: string | null
) => {
  const actor = actorName || '誰か';

  switch (action) {
    case 'TASK_CREATED':
      return <><span className="font-bold">{actor}</span>さんがタスクを作成しました</>;

    case 'TASK_UPDATED': {
      const changes = details?.changes;
      if (!changes && !details?.assignee_name) {
        return <><span className="font-bold">{actor}</span>さんがタスクを更新しました</>;
      }

      const parts: string[] = [];
      if (changes?.status) {
        const newLabel = TASK_STATUS_LABEL[changes.status.new as keyof typeof TASK_STATUS_LABEL] ?? changes.status.new;
        parts.push(`ステータスを「${newLabel}」に変更`);
      }

      if (details.assignee_name) {
        const newAssignee = details.assignee_name.new ?? '未担当';
        parts.push(`担当者を「${newAssignee}」に変更`);
      }

      const fieldNames: Record<string, string> = {
        title: 'タイトル',
        description: '説明',
        due_date: '期限日',
        start_date: '開始日',
      };

      if (changes) {
        Object.keys(changes)
          .filter(k => k !== 'status' && k !== 'assignee_id')
          .forEach(k => {
            if (fieldNames[k]) parts.push(`${fieldNames[k]}を更新`);
          });
      }

      if (parts.length === 0) {
        return <><span className="font-bold">{actor}</span>さんがタスクを更新しました</>;
      }
      return <><span className="font-bold">{actor}</span>さんが{parts.join('、')}しました</>;
    }

    case 'COMMENT_ADDED': {
      const preview = details?.preview;
      const content = preview ? `：「${preview}${preview.length >= 50 ? '...' : ''}」` : '';
      return <><span className="font-bold">{actor}</span>さんがコメントしました{content}</>;
    }

    case 'FILE_ATTACHED':
      return <><span className="font-bold">{actor}</span>さんがファイルを添付しました</>;

    case 'FILE_DELETED':
      return <><span className="font-bold">{actor}</span>さんがファイルを削除しました</>;

    default:
      return <><span className="font-bold">{actor}</span>さんが操作しました</>;
  }
};
