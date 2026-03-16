import { useState, useEffect, useCallback, useMemo } from 'react';
import { TASK_STATUS, type Task, type SortOrder, type TaskStatus } from '../types';

export const useTaskManager = (currentProjectId: number | null, apiFetch: any) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  // タスクの取得
  const fetchTasks = useCallback(async () => {
    if (!currentProjectId) {
      setTasks([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/tasks?projectId=${currentProjectId}`);
      const data = await res.json();
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProjectId]);

  // プロジェクトが切り替わった時にタスクを再取得
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // タスクの追加
  const addTask = async (title: string, assigneeId: number | '') => {
    if (!currentProjectId) return;
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          project_id: currentProjectId,
          assignee_id: assigneeId === '' ? null : assigneeId,
        }),
      });
      // 追加成功後に一覧を再取得
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // タスクのステータス変更
  const toggleTaskStatus = async (task: Task) => {
    let newStatus: TaskStatus = TASK_STATUS.TODO;
    if (task.status === TASK_STATUS.TODO) newStatus = TASK_STATUS.DOING;
    else if (task.status === TASK_STATUS.DOING) newStatus = TASK_STATUS.DONE;

    // オプティミスティックUI: 通信完了を待たずに画面（State）を先に更新
    const previousTasks = [...tasks];
    setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      // 失敗した場合は元の状態に戻す
      setTasks(previousTasks);
      alert('ステータスの更新に失敗しました。');
    }
  };

  // タスクの削除
  const deleteTask = async (id: number) => {
    // オプティミスティックUI: 画面から即座に消す
    const previousTasks = [...tasks];
    setTasks(prevTasks => prevTasks.filter(t => t.id !== id));

    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      // 失敗した場合は元の状態に戻す
      setTasks(previousTasks);
      alert('削除に失敗しました。');
    }
  };

  // ソート機能
  const displayedTasks = useMemo(() => {
    if (sortOrder === 'default') return tasks;
    return [...tasks].sort((a, b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
  }, [tasks, sortOrder]);

  return {
    tasks: displayedTasks,
    rawTasks: tasks,
    loading,
    error,
    sortOrder,
    setSortOrder,
    addTask,
    toggleTaskStatus,
    deleteTask,
    refreshTasks: fetchTasks,
  };
};
