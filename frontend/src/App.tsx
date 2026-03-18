import React, { useEffect, useState, useCallback } from 'react';
import { InviteMemberModal } from './components/InviteMemberModal';
import { InviteUserModal } from './components/InviteUserModal';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { useTaskManager } from './hooks/useTaskManager';
import { type UserData, type ProjectData, type SortOrder, type ProjectMember } from './types';
import { CheckCircle2, RefreshCw, AlertCircle, Plus, LogOut, Folder, Mail, Lock, UserPlus } from 'lucide-react';

// ==========================================
// 1. 認証カスタムフック (Auth Logic)
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
// 2. 認証画面コンポーネント (AuthScreen)
// ==========================================
const AuthScreen: React.FC<{
  onLogin: (e: string, p: string) => Promise<void>
}> = ({ onLogin }) => {
  const [email, setEmail] = useState('yamada@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit: React.ComponentProps<'form'>['onSubmit'] = async (e) => {
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
// 3. メインアプリケーション (ログイン後)
// ==========================================
const MainApp: React.FC<{ user: UserData, logout: () => void, apiFetch: any, token: string }> = ({ user, logout, apiFetch, token }) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = useState(false);

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  // 初期データ（プロジェクトとユーザー）取得用のローディングとエラー
  const [initialLoading, setInitialLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 💡 カスタムフックを呼び出してタスク関連のロジックを取得
  const {
    tasks: displayedTasks,
    rawTasks,
    loading: tasksLoading,
    error: tasksError,
    sortOrder,
    setSortOrder,
    addTask,
    toggleTaskStatus,
    deleteTask
  } = useTaskManager(currentProjectId, apiFetch);

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
        setGlobalError(err.message);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchInitialData();
  }, [apiFetch]);

  const fetchProjectMembers = useCallback(async () => {
    if (!currentProjectId) {
      setProjectMembers([]);
      return;
    }
    try {
      const res = await apiFetch(`/projects/${currentProjectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setProjectMembers(data.members || []);
      }
    } catch (err: any) {
      console.error('メンバー取得エラー:', err.message);
    }
  }, [currentProjectId, apiFetch]);

  useEffect(() => {
    if (!isInviteModalOpen) {
      fetchProjectMembers();
    }
  }, [fetchProjectMembers, isInviteModalOpen]);

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

  // 現在選択中のプロジェクトの情報を取得し、自分の権限（Role）を特定する
  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentUserRole = currentProject?.role;

  // 組織レベルの管理者かどうかを簡易判定
  // プロジェクトが1つもない初期状態、または自分がOwnerとして参加しているプロジェクトが1つでもあれば許可
  const isTenantOwner = projects.length === 0 || projects.some(p => p.role === 'Owner');

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
              {isTenantOwner && (
                <button onClick={createProject} className="ml-2 p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="プロジェクト追加">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* メンバー招待ボタン */}
            {currentProjectId && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="hidden sm:flex items-center text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-bold"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                メンバー管理
              </button>
            )}

            {isTenantOwner && (
              <button
                onClick={() => setIsInviteUserModalOpen(true)}
                className="hidden sm:flex items-center text-sm bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors font-bold"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                組織に招待
              </button>
            )}

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
        {(globalError || tasksError) && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle className="w-6 h-6" />
            <p className="font-bold">{globalError || tasksError}</p>
          </div>
        )}

        {!currentProjectId && !initialLoading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">プロジェクトがありません</h2>
            <p className="text-slate-500 mb-6">タスクを管理するには、まずプロジェクトを作成してください。</p>
            {isTenantOwner && (
              <button onClick={createProject} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto">
                <Plus className="w-5 h-5" />
                <span>最初のプロジェクトを作成</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-800">{currentProject?.name}</h2>
              {currentUserRole && (
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  currentUserRole === 'Owner' ? 'bg-amber-100 text-amber-700' :
                  currentUserRole === 'Editor' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {currentUserRole}
                </span>
              )}
            </div>

            {(currentUserRole === 'Owner' || currentUserRole === 'Editor') && (
              <TaskForm users={projectMembers} onAdd={addTask} />
            )}

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">タスク一覧 <span className="text-slate-400 text-sm">({rawTasks.length}件)</span></h2>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="text-sm border-2 border-slate-200 rounded-xl px-3 py-1.5 bg-white font-medium cursor-pointer">
                <option value="default">標準</option>
                <option value="asc">古い順</option>
                <option value="desc">新しい順</option>
              </select>
            </div>

            {tasksLoading && rawTasks.length === 0 ? (
              <div className="text-center py-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" /></div>
            ) : rawTasks.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-xl">タスクはありません</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTaskStatus}
                    onDelete={deleteTask}
                    currentUserRole={currentUserRole}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {currentProjectId !== null && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          projectId={currentProjectId}
          currentUserRole={currentUserRole}
          apiFetch={apiFetch}
        />
      )}

      <InviteUserModal
        isOpen={isInviteUserModalOpen}
        onClose={() => setIsInviteUserModalOpen(false)}
        onInviteSuccess={(newUser) => {
          setUsers([...users, newUser]);
        }}
        apiFetch={apiFetch}
      />
    </div>
  );
};

// ==========================================
// 4. アプリケーション エントリーポイント
// ==========================================
export default function App() {
  const { token, user, login, logout, apiFetch } = useAuth();

  // トークンがない場合はログイン画面を表示
  if (!token || !user) {
    return <AuthScreen onLogin={login} />;
  }

  // ログイン後はメイン画面を表示
  return <MainApp user={user} logout={logout} apiFetch={apiFetch} token={token} />;
}
