import { useState, useEffect, useCallback, useMemo } from 'react';
import { TASK_STATUS, type Task, type SortOrder, type TaskStatus } from '../types';
import { useSocket } from '../contexts/SocketContext';

export const useTaskManager = (currentProjectId: number | null, apiFetch: any, currentUserId?: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [activeKeyword, setActiveKeyword] = useState<string>('');

  const { socket } = useSocket();

  // WebSocketイベントの購読
  useEffect(() => {
    if (!socket || !currentProjectId) return;

    const handleTaskCreated = (data: { task: Task; senderId: number }) => {
      // 自分の操作なら無視（既にオプティミスティックUIで反映済み、またはfetchTasksで更新済み）
      if (data.senderId === currentUserId) return;

      // 現在表示中のプロジェクトのタスクであれば追加
      if (data.task.project_id === currentProjectId) {
        setTasks(prev => [...prev, data.task]);
      }
    };

    const handleTaskUpdated = (data: { task: Task; senderId: number }) => {
      if (data.senderId === currentUserId) return;

      setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
    };

    const handleTaskDeleted = (data: { taskId: number; senderId: number }) => {
      if (data.senderId === currentUserId) return;

      setTasks(prev => prev.filter(t => t.id !== data.taskId));
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [socket, currentProjectId, currentUserId]);

  // タスクの取得
  const fetchTasks = useCallback(async () => {
    if (!currentProjectId) {
      setTasks([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('projectId', currentProjectId.toString());

      if (filterStatus) params.append('status', filterStatus);
      if (filterAssignee) params.append('assigneeId', filterAssignee);
      if (activeKeyword) params.append('keyword', activeKeyword);

      const res = await apiFetch(`/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProjectId, filterStatus, filterAssignee, activeKeyword]);

  // プロジェクトが切り替わった時、またはフィルターが変わった時にタスクを再取得
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 外部からキーワード検索を実行する関数
  const executeSearch = () => {
    setActiveKeyword(filterKeyword);
  }

  // フィルターをリセットする関数
  const clearFilters = () => {
    setFilterStatus('');
    setFilterAssignee('');
    setFilterKeyword('');
    setActiveKeyword('');
  }

  // タスクの追加
  const addTask = async (title: string, assigneeId: number | '', start_date: string, due_date: string) => {
    if (!currentProjectId) return;
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          project_id: currentProjectId,
          assignee_id: assigneeId === '' ? null : assigneeId,
          start_date: start_date || null,
          due_date: due_date || null,
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
    setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      // 失敗した場合は該当タスクのみ元の状態に戻す
      setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? task : t));
      alert('ステータスの更新に失敗しました。');
    }
  };

  // タスクの編集
  const editTask = async (id: number, updates: { title?: string; assignee_id?: number | null; start_date?: string | null; due_date?: string | null }) => {
    // 変更前のタスクを保存
    const previousTask = tasks.find(t => t.id === id);
    if (!previousTask) return;

    // オプティミスティックUI: 通信を待たずに画面を先に更新
    setTasks(prevTasks => prevTasks.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      // 成功時も、DBでの正規化された値（RETURNINGされた値など）を反映させたい場合はfetchTasks()する
      // ここでは整合性を重視してfetchTasks()を残すが、ロールバックは個別に行う
      fetchTasks();
    } catch (err) {
      // 失敗した場合は該当タスクのみ元の状態に戻す
      setTasks(prevTasks => prevTasks.map(t => t.id === id ? previousTask : t));
      alert('タスクの更新に失敗しました。');
      throw err;
    }
  };

  // タスクの削除
  const deleteTask = async (id: number) => {
    // 削除対象のタスクを一時保存
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    // オプティミスティックUI: 画面から即座に消す
    setTasks(prevTasks => prevTasks.filter(t => t.id !== id));

    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      // 失敗した場合は再取得して元の状態に戻す（リスト順序の整合性のため再取得）
      fetchTasks();
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
    editTask,
    refreshTasks: fetchTasks,
    filterStatus, setFilterStatus,
    filterAssignee, setFilterAssignee,
    filterKeyword, setFilterKeyword,
    executeSearch,
    clearFilters,
  };
};
