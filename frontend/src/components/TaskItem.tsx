import React from 'react';
import { TASK_STATUS, type Task } from '../types';
import { CheckCircle2, Circle, CircleDot, Clock, User, Trash2 } from 'lucide-react';

export const TaskItem: React.FC<{ task: Task, onToggle: (t: Task) => void, onDelete: (id: number) => void }> = ({ task, onToggle, onDelete }) => {
  const handleDelete = () => {
    if (window.confirm('このタスクを削除してもよろしいですか？')) {
      onDelete(task.id);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group flex items-start gap-4">
      <button onClick={() => onToggle(task)} className="mt-0.5">
        {task.status === TASK_STATUS.DONE ? (
          <div className="p-1 bg-emerald-50 rounded-full border border-emerald-200"><CheckCircle2 className="text-emerald-500 w-5 h-5" /></div>
        ) : task.status === TASK_STATUS.DOING ? (
          <div className="p-1 bg-blue-50 rounded-full border border-blue-200"><CircleDot className="text-blue-500 w-5 h-5" /></div>
        ) : (
          <div className="p-1 bg-slate-50 rounded-full border border-slate-200"><Circle className="text-slate-300 w-5 h-5" /></div>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className={`font-bold text-lg truncate ${task.status === TASK_STATUS.DONE ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${task.status === TASK_STATUS.DONE ? 'bg-emerald-100 text-emerald-700' : task.status === TASK_STATUS.DOING ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {task.status}
            </span>
            <button onClick={handleDelete} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors" title="タスクを削除">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 flex items-center gap-1">
            <User className="w-3 h-3"/> {task.assignee_name || '未担当'}
          </span>
          <span className="text-xs font-bold text-slate-300 ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3"/> ID:{task.id}
          </span>
        </div>
      </div>
    </div>
  );
};
