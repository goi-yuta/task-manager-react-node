import { useState, useEffect, useMemo } from 'react';
import { TASK_STATUS, type Task, type UserData, type SortOrder, type TaskStatus } from '../types';

export const useTaskManager = (projectId: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserData[]>([{ id: 1, name: '山田太郎' }]); // フォールバック
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 💡 ソート順を管理するステートを追加
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const fetchDependencies = async () => {
    try {
      const usersRes = await fetch('http://localhost:3000/users').catch(() => null);
      if (usersRes && usersRes.ok) {
        const data = await usersRes.json();
        if (data.users) setUsers(data.users);
      }
    } catch (err) {
      console.warn('マスタデータの取得に失敗したため、初期値を使用します。');
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:3000/projects/${projectId}/tasks`);
      if (!response.ok) throw new Error('データの取得に失敗しました');
      const data = await response.json();

      // 💡 バックエンドからの並び順をそのまま保持します（強制ソートを削除）
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (title: string, assigneeId: number | '') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await fetch('http://localhost:3000/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        project_id: projectId,
        assignee_id: assigneeId === '' ? null : assigneeId,
        due_date: tomorrow.toISOString(),
        created_by: 1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error (POST /tasks):', response.status, errorText);
      throw new Error(`タスクの追加に失敗しました (ステータスコード: ${response.status})`);
    }
    await fetchTasks();
  };

  const toggleTaskStatus = async (task: Task) => {
    let newStatus: TaskStatus = TASK_STATUS.TODO;
    if (task.status === TASK_STATUS.TODO) newStatus = TASK_STATUS.DOING;
    else if (task.status === TASK_STATUS.DOING) newStatus = TASK_STATUS.DONE;

    const previousTasks = [...tasks];
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      const response = await fetch(`http://localhost:3000/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('更新に失敗');
    } catch (err) {
      setTasks(previousTasks);
      alert('ステータスの更新に失敗しました。');
    }
  };

  const deleteTask = async (id: number) => {
    const previousTasks = [...tasks];
    setTasks(tasks.filter(t => t.id !== id));

    try {
      const response = await fetch(`http://localhost:3000/tasks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('削除に失敗');
    } catch (err) {
      setTasks(previousTasks);
      alert('削除に失敗しました。');
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchDependencies();
  }, [projectId]);

  // 💡 画面に返すタスク配列を、選択されたソート順に合わせて動的に並び替えます
  const displayedTasks = useMemo(() => {
    if (sortOrder === 'default') return tasks;
    return [...tasks].sort((a, b) => {
      if (sortOrder === 'asc') return a.id - b.id;
      return b.id - a.id; // desc
    });
  }, [tasks, sortOrder]);

  return {
    tasks: displayedTasks,
    users,
    loading,
    error,
    sortOrder,
    setSortOrder,
    addTask,
    toggleTaskStatus,
    deleteTask,
    refreshTasks: fetchTasks
  };
};
