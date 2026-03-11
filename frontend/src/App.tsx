import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CheckCircle2, Circle, CircleDot, Clock, User, RefreshCw, AlertCircle, Plus, Trash2, LogOut, Folder, Mail, Lock } from 'lucide-react';

// ==========================================
// 1. 型定義・定数
// ==========================================
export const TASK_STATUS = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  assignee_id: number | null;
  assignee_name: string | null;
  project_id: number;
  project_name?: string;
}

export interface UserData {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
}

export interface ProjectData {
  id: number;
  name: string;
  description: string;
}

export type SortOrder = 'default' | 'asc' | 'desc';

// ==========================================
// 2. 認証カスタムフック (Auth Logic)
// ==========================================
const useAuth = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserData | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  // ログイン処理
  const login = async (email: string, password: string) => {
    const res = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'ログインに失敗しました');
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  // ログアウト処理
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // 認証トークンを自動で付与する fetch ラッパー
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`http://localhost:3000${endpoint}`, { ...options, headers });

    // トークンが無効な場合は強制ログアウト
    if (res.status === 401 || res.status === 403) {
      logout();
      throw new Error('セッションが切れました。再度ログインしてください。');
    }
    return res;
  }, [token, logout]);

  return { token, user, login, logout, apiFetch };
};

// ==========================================
// 3. 認証画面コンポーネント (AuthScreen)
// ==========================================
const AuthScreen: React.FC<{
  onLogin: (e: string, p: string) => Promise<void>
}> = ({ onLogin }) => {
  const [email, setEmail] = useState('yamada@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Task Manager</h1>
          <p className="text-slate-500 mt-2 font-medium">アカウントにログイン</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">メールアドレス</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="name@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">パスワード</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="••••••••" />
            </div>
          </div>

          <button disabled={loading} type="submit" className="mt-2 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-70 flex justify-center items-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. メインアプリケーション (ログイン後)
// ==========================================
const MainApp: React.FC<{ user: UserData, logout: () => void, apiFetch: any }> = ({ user, logout, apiFetch }) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  // 初期データの取得（プロジェクト一覧とユーザー一覧）
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [projRes, usersRes] = await Promise.all([
          apiFetch('/projects'),
          apiFetch('/users')
        ]);
        const projData = await projRes.json();
        const usersData = await usersRes.json();

        setProjects(projData.projects);
        setUsers(usersData.users);

        if (projData.projects.length > 0 && !currentProjectId) {
          setCurrentProjectId(projData.projects[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [apiFetch]);

  // プロジェクト切り替え時のタスク取得
  const fetchTasks = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/tasks?projectId=${currentProjectId}`);
      const data = await res.json();
      setTasks(data.tasks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentProjectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 新規プロジェクト作成
  const createProject = async () => {
    const name = prompt('新しいプロジェクト名を入力してください');
    if (!name) return;
    try {
      const res = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: '' })
      });
      const newProject = await res.json();
      setProjects([...projects, newProject]);
      setCurrentProjectId(newProject.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // タスクの操作
  const addTask = async (title: string, assigneeId: number | '') => {
    if (!currentProjectId) return;
    await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        project_id: currentProjectId,
        assignee_id: assigneeId === '' ? null : assigneeId,
      }),
    });
    fetchTasks();
  };

  const toggleTaskStatus = async (task: Task) => {
    let newStatus: TaskStatus = TASK_STATUS.TODO;
    if (task.status === TASK_STATUS.TODO) newStatus = TASK_STATUS.DOING;
    else if (task.status === TASK_STATUS.DOING) newStatus = TASK_STATUS.DONE;

    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      fetchTasks(); // 失敗したら元に戻す
      alert('ステータスの更新に失敗しました。');
    }
  };

  const deleteTask = async (id: number) => {
    if (!window.confirm('このタスクを削除してもよろしいですか？')) return;
    setTasks(tasks.filter(t => t.id !== id));
    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      fetchTasks();
      alert('削除に失敗しました。');
    }
  };

  const displayedTasks = useMemo(() => {
    if (sortOrder === 'default') return tasks;
    return [...tasks].sort((a, b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
  }, [tasks, sortOrder]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold"><CheckCircle2 className="w-5 h-5"/></div>
              <span className="font-extrabold text-xl tracking-tight hidden sm:block">TaskManager</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Folder className="w-4 h-4 text-slate-400" />
              <select
                value={currentProjectId || ''}
                onChange={(e) => setCurrentProjectId(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {projects.length === 0 && <option value="">プロジェクトなし</option>}
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={createProject} className="ml-2 p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="プロジェクト追加">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-700 leading-tight">{user.name}</p>
                <p className="text-xs text-slate-400">テナントID: {user.tenant_id}</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2" title="ログアウト">
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-bold hidden sm:block">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle className="w-6 h-6" />
            <p className="font-bold">{error}</p>
          </div>
        )}

        {!currentProjectId && !loading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">プロジェクトがありません</h2>
            <p className="text-slate-500 mb-6">タスクを管理するには、まずプロジェクトを作成してください。</p>
            <button onClick={createProject} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto">
              <Plus className="w-5 h-5" />
              <span>最初のプロジェクトを作成</span>
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={async (e) => { e.preventDefault(); const t = (e.target as any).title.value; const a = (e.target as any).assignee.value; if(t) { await addTask(t, Number(a)); (e.target as any).reset(); } }} className="mb-8 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4">
              <input name="title" required type="text" placeholder="新しいタスクを入力..." className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium" />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:w-48">
                <User className="w-4 h-4 text-slate-400" />
                <select name="assignee" className="bg-transparent w-full focus:outline-none text-sm font-medium cursor-pointer" defaultValue={user.id}>
                  <option value="">未担当</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /><span>追加</span>
              </button>
            </form>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">タスク一覧 <span className="text-slate-400 text-sm">({tasks.length}件)</span></h2>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="text-sm border-2 border-slate-200 rounded-xl px-3 py-1.5 bg-white font-medium cursor-pointer">
                <option value="default">標準</option>
                <option value="asc">古い順</option>
                <option value="desc">新しい順</option>
              </select>
            </div>

            {loading && tasks.length === 0 ? (
              <div className="text-center py-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-xl">タスクはありません</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedTasks.map(task => (
                  <div key={task.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group flex items-start gap-4">
                    <button onClick={() => toggleTaskStatus(task)} className="mt-0.5">
                      {task.status === TASK_STATUS.DONE ? <div className="p-1 bg-emerald-50 rounded-full border border-emerald-200"><CheckCircle2 className="text-emerald-500 w-5 h-5" /></div> : 
                       task.status === TASK_STATUS.DOING ? <div className="p-1 bg-blue-50 rounded-full border border-blue-200"><CircleDot className="text-blue-500 w-5 h-5" /></div> : 
                       <div className="p-1 bg-slate-50 rounded-full border border-slate-200"><Circle className="text-slate-300 w-5 h-5" /></div>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className={`font-bold text-lg truncate ${task.status === TASK_STATUS.DONE ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${task.status === TASK_STATUS.DONE ? 'bg-emerald-100 text-emerald-700' : task.status === TASK_STATUS.DOING ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{task.status}</span>
                          <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 flex items-center gap-1"><User className="w-3 h-3"/> {task.assignee_name || '未担当'}</span>
                        <span className="text-xs font-bold text-slate-300 ml-auto flex items-center gap-1"><Clock className="w-3 h-3"/> ID:{task.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ==========================================
// 5. アプリケーション エントリーポイント
// ==========================================
export default function App() {
  const { token, user, login, logout, apiFetch } = useAuth();

  // トークンがない場合はログイン画面を表示
  if (!token || !user) {
    return <AuthScreen onLogin={login} />;
  }

  // ログイン後はメイン画面を表示
  return <MainApp user={user} logout={logout} apiFetch={apiFetch} />;
}
