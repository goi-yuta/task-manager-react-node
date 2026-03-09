import React from 'react';
import { TASK_STATUS, type Task } from '../types';
import { CheckCircle2, Circle, CircleDot, Clock, Layout, User, Trash2 } from 'lucide-react';

export const TaskItem: React.FC<{ task: Task, onToggle: (t: Task) => void, onDelete: (id: number) => void }> = ({ task, onToggle, onDelete }) => {
  const handleDelete = () => {
    if (window.confirm('このタスクを削除してもよろしいですか？')) {
      onDelete(task.id);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 group">
      <div className="flex items-start gap-4 sm:gap-5">
        <button onClick={() => onToggle(task)} className="mt-1 flex-shrink-0 focus:outline-none rounded-full" title="ステータスを変更">
          {/* 💡 UIの条件分岐でも定数を使用 */}
          {task.status === TASK_STATUS.DONE ? (
            <div className="p-1.5 bg-emerald-50 rounded-full border border-emerald-200"><CheckCircle2 className="text-emerald-500 w-6 h-6" /></div>
          ) : task.status === TASK_STATUS.DOING ? (
            <div className="p-1.5 bg-blue-50 rounded-full border border-blue-200 group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-colors"><CircleDot className="text-blue-500 w-6 h-6" /></div>
          ) : (
            <div className="p-1.5 bg-slate-50 rounded-full border border-slate-200 group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-colors"><Circle className="text-slate-300 w-6 h-6 group-hover:text-indigo-400" /></div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className={`text-lg sm:text-xl font-bold truncate transition-colors ${task.status === TASK_STATUS.DONE ? 'line-through text-slate-300' : 'text-slate-800'}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {/* 💡 ラベルの色分けも定数を使用 */}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                task.status === TASK_STATUS.DONE ? 'bg-emerald-100 text-emerald-700' :
                task.status === TASK_STATUS.DOING ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {task.status}
              </span>
              <button onClick={handleDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="タスクを削除">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-100">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate max-w-[100px] sm:max-w-none">{task.assignee_name || '未担当'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-100 hidden sm:flex">
              <Layout className="w-3.5 h-3.5 text-slate-400" />
              <span>{task.project_name || 'メインプロジェクト'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 sm:ml-auto uppercase tracking-tighter mt-1 sm:mt-0">
              <Clock className="w-3.5 h-3.5" />
              <span>ID: {task.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
