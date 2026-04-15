import React, { useState, useEffect, useCallback } from 'react';
import { TASK_STATUS_LABEL } from '../types';

// ログの型定義
export interface ActivityLog {
  id: number;
  action: string;
  details: any;
  created_at: string;
  user_id: number;
  user_name: string | null;
}

interface TaskActivityLogProps {
  taskId: number;
  apiFetch?: (endpoint: string, options?: RequestInit) => Promise<Response>;
  refreshTrigger?: number;
}

// アクションと詳細（JSONB）から、表示用の日本語メッセージを生成する関数
const formatLogMessage = (log: ActivityLog) => {
  // 退職等でユーザーが削除されていた場合のフォールバック（LEFT JOINの恩恵！）
  const userName = log.user_name || '退職済みユーザー';

  switch (log.action) {
    case 'TASK_CREATED':
      return `${userName} がタスクを作成しました。`;

    case 'TASK_UPDATED': {
      if (!log.details?.changes) return `${userName} がタスクを更新しました。`;

      const changes = log.details.changes;
      const parts: string[] = [];

      // ステータス変更
      if (changes.status) {
        const oldLabel = TASK_STATUS_LABEL[changes.status.old as keyof typeof TASK_STATUS_LABEL] ?? changes.status.old;
        const newLabel = TASK_STATUS_LABEL[changes.status.new as keyof typeof TASK_STATUS_LABEL] ?? changes.status.new;
        parts.push(`ステータスを「${oldLabel}」から「${newLabel}」に変更`);
      }

      // 担当者変更（changes とは別の assignee_name フィールドから取得）
      if (log.details.assignee_name) {
        const oldAssignee = log.details.assignee_name.old ?? '未担当';
        const newAssignee = log.details.assignee_name.new ?? '未担当';
        parts.push(`担当者を「${oldAssignee}」から「${newAssignee}」に変更`);
      }

      // その他のフィールド変更
      const fieldNames: Record<string, string> = {
        title: 'タイトル',
        description: '説明',
        due_date: '期限日',
        start_date: '開始日',
      };
      Object.keys(changes)
        .filter(k => k !== 'status' && k !== 'assignee_id')
        .forEach(k => {
          if (fieldNames[k]) parts.push(`${fieldNames[k]}を更新`);
        });

      if (parts.length === 0) return `${userName} がタスクを更新しました。`;
      return `${userName} が${parts.join('、')}しました。`;
    }

    case 'FILE_ATTACHED':
      return `${userName} がファイルを添付しました。`;

    case 'FILE_DELETED':
      return `${userName} がファイルを削除しました。`;

    case 'COMMENT_ADDED': {
      const preview = log.details?.preview;
      if (preview) {
        const suffix = preview.length >= 50 ? '...' : '';
        return `${userName} がコメントしました：「${preview}${suffix}」`;
      }
      return `${userName} がコメントしました。`;
    }

    default:
      return `${userName} がタスクを操作しました。`;
  }
};

export const TaskActivityLog: React.FC<TaskActivityLogProps> = ({ taskId, apiFetch, refreshTrigger = 0 }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ログを取得する処理
  const fetchLogs = useCallback(async () => {
    if (!taskId || !apiFetch) return;

    try {
      setLoading(true);
      const res = await apiFetch(`/tasks/${taskId}/logs`);
      if (!res.ok) throw new Error('ログの取得に失敗しました');

      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [taskId, apiFetch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  if (loading && isInitialLoad) return <div className="text-gray-500 text-sm">読み込み中...</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (logs.length === 0) return <div className="text-gray-500 text-sm">履歴はありません</div>;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-sm font-bold text-gray-700 mb-4">アクティビティ履歴</h3>
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start text-sm">
            {/* タイムラインの丸いアイコン */}
            <div className="flex-shrink-0 w-8 flex justify-center mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>

            {/* ログの内容と日付 */}
            <div>
              <p className="text-gray-800">{formatLogMessage(log)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(log.created_at).toLocaleString('ja-JP')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
