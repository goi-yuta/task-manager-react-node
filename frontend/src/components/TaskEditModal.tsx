import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar } from 'lucide-react';
import { type Task, type ProjectMember } from '../types';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  users: ProjectMember[];
  onSave: (updates: { title: string; assignee_id: number | null; start_date: string | null; due_date: string | null }) => Promise<void>;
  currentUserRole?: string;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({ isOpen, onClose, task, users, onSave, currentUserRole }) => {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewer = currentUserRole === 'Viewer';

  // モーダルが開かれた時に、タスクの現在値をフォームにセットする
  useEffect(() => {
    if (task && isOpen) {
      const formatDateForInput = (dateString: string | null | undefined) => {
        if (!dateString) return '';
        // 例: "2026-03-21T15:00:00.000Z" -> "2026-03-21"
        // 例: "2026-03-21" -> "2026-03-21"
        return dateString.substring(0, 10);
      };

      setTitle(task.title);
      setAssigneeId(task.assignee_id || '');
      setStartDate(task.start_date ? formatDateForInput(task.start_date) : '');
      setDueDate(task.due_date ? formatDateForInput(task.due_date) : '');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit: React.ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    if (!title.trim() || isViewer) return;

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      alert('開始日は期限日より前（または同じ日）を指定してください');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title,
        assignee_id: assigneeId === '' ? null : Number(assigneeId),
        start_date: startDate || null,
        due_date: dueDate || null
      });
    } catch (err: any) {
      // エラーハンドリングは親（App.tsx）で行う
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">タスクの編集</h2>
            <p className="text-sm text-slate-500 mt-1">ID: {task.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">タイトル</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isViewer || isSubmitting}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-70"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">担当者</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
                disabled={isViewer || isSubmitting}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-70"
              >
                <option value="">未担当</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">開始日</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isViewer || isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">期限日</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isViewer || isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {!isViewer && (
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="mt-4 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-70 flex justify-center items-center gap-2"
            >
              {isSubmitting ? '保存中...' : <><Save className="w-5 h-5" /> 保存する</>}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
