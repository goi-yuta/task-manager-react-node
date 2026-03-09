import React from 'react';
import { type Task, type SortOrder } from './types';
import { useTaskManager } from './hooks/useTaskManager';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { CheckCircle2, RefreshCw, AlertCircle, ArrowDownUp } from 'lucide-react';

const App: React.FC = () => {
  const currentProjectId = 1;
  const { tasks, users, loading, error, sortOrder, setSortOrder, addTask, toggleTaskStatus, deleteTask, refreshTasks } = useTaskManager(currentProjectId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Task Manager</h1>
            <p className="text-slate-500 mt-1 italic font-medium">Refactored & Clean Code ✨</p>
          </div>
          <button
            onClick={refreshTasks} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-all shadow-sm border border-slate-200 active:scale-95 disabled:opacity-50 font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </button>
        </header>

        {/* 💡 分離したフォームコンポーネントを配置 */}
        <TaskForm users={users} onAdd={addTask} />

        {/* 💡 タスク一覧のヘッダーとソート機能を追加 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-xl font-bold text-slate-800">タスク一覧 <span className="text-slate-400 text-sm font-normal ml-2">({tasks.length}件)</span></h2>
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-slate-400" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="text-sm border-2 border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer font-medium text-slate-700"
            >
              <option value="default">バックエンド標準</option>
              <option value="asc">ID昇順 (古い順)</option>
              <option value="desc">ID降順 (新しい順)</option>
            </select>
          </div>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-400 font-medium text-lg">データを読み込み中...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 text-red-700 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-red-100 rounded-full text-red-600"><AlertCircle className="w-6 h-6" /></div>
            <div><p className="font-bold text-lg">通信エラーが発生しました</p><p className="text-sm opacity-90">{error}</p></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* 💡 分離したタスクコンポーネントをループで配置 */}
            {tasks.map((task: Task) => (
              <TaskItem key={task.id} task={task} onToggle={toggleTaskStatus} onDelete={deleteTask} />
            ))}

            {tasks.length === 0 && (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-xl">すべてのタスクが完了しました！</p>
              </div>
            )}
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-center">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest italic">&copy; 2024 Fullstack Journey.</p>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-full border border-slate-200">
             <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API: Connected</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
