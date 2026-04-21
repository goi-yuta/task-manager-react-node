import React, { useState, useEffect, useCallback } from 'react';
import { formatActivityMessage } from '../utils/formatters';

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
              <p className="text-gray-800">{formatActivityMessage(log.action, log.details, log.user_name)}</p>
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
