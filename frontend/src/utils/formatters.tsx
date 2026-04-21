import { TASK_STATUS_LABEL } from '../types';

const FIELD_NAMES: Record<string, string> = {
  title: 'タイトル',
  description: '説明',
  due_date: '期限日',
  start_date: '開始日',
};

/**
 * アクティビティの変更内容を日本語の文字列パーツに変換する（共通ロジック）
 */
const buildUpdateParts = (details: any): string[] => {
  const changes = details?.changes;
  const parts: string[] = [];

  if (changes?.status) {
    const newLabel = TASK_STATUS_LABEL[changes.status.new as keyof typeof TASK_STATUS_LABEL] ?? changes.status.new;
    parts.push(`ステータスを「${newLabel}」に変更`);
  }

  if (details?.assignee_name) {
    const newAssignee = details.assignee_name.new ?? '未担当';
    parts.push(`担当者を「${newAssignee}」に変更`);
  }

  if (changes) {
    Object.keys(changes)
      .filter(k => k !== 'status' && k !== 'assignee_id')
      .forEach(k => {
        if (FIELD_NAMES[k]) parts.push(`${FIELD_NAMES[k]}を更新`);
      });
  }

  return parts;
};

/**
 * プレーンテキスト版：メール通知・Slack連携等で利用可能
 */
export const formatActivityMessageText = (
  action: string,
  details: any,
  actorName: string | null
): string => {
  const actor = actorName || '誰か';

  switch (action) {
    case 'TASK_CREATED':
      return `${actor}さんがタスクを作成しました`;

    case 'TASK_UPDATED': {
      const parts = buildUpdateParts(details);
      if (parts.length === 0) return `${actor}さんがタスクを更新しました`;
      return `${actor}さんが${parts.join('、')}しました`;
    }

    case 'COMMENT_ADDED': {
      const preview = details?.preview;
      const content = preview ? `：「${preview}${preview.length >= 50 ? '...' : ''}」` : '';
      return `${actor}さんがコメントしました${content}`;
    }

    case 'FILE_ATTACHED':
      return `${actor}さんがファイルを添付しました`;

    case 'FILE_DELETED':
      return `${actor}さんがファイルを削除しました`;

    default:
      return `${actor}さんが操作しました`;
  }
};

/**
 * JSX版：UI上のアクティビティログ・通知表示用
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
      const parts = buildUpdateParts(details);
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
