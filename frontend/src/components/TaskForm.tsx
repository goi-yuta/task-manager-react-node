import React, { useState } from 'react';
import { type UserData, type ProjectMember } from '../types';
import { User, Plus, Calendar } from 'lucide-react';

export const TaskForm: React.FC<{ users: (UserData | ProjectMember)[], onAdd: (title: string, assigneeId: number | '', startDate: string, dueDate: string) => Promise<void> }> = ({ users, onAdd }) => {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>(1);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: React.ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      alert('開始日は期限日より前（または同じ日）を指定してください');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(title, assigneeId, startDate, dueDate);
      setTitle('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 bg-white p-4 sm:p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新しいタスクを入力..."
          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
          disabled={isSubmitting}
        />
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:w-48 shrink-0">
          <User className="w-4 h-4 text-slate-400" />
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(Number(e.target.value) || '')}
            className="bg-transparent w-full focus:outline-none text-sm font-medium cursor-pointer"
            disabled={isSubmitting}
          >
            <option value="">未担当</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 w-full sm:w-auto text-sm text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 w-full"
              title="開始日"
            />
            <span className="text-slate-400 font-bold">〜</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 w-full"
              title="期限日"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="w-full sm:w-auto px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 shadow-sm"
        >
          <Plus className="w-5 h-5" /><span>追加</span>
        </button>
      </div>
    </form>
  );
};
