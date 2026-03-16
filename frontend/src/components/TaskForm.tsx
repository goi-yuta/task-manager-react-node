import React, { useState } from 'react';
import { type UserData } from '../types';
import { User, Plus } from 'lucide-react';

export const TaskForm: React.FC<{ users: UserData[], onAdd: (title: string, assigneeId: number | '') => Promise<void> }> = ({ users, onAdd }) => {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: React.ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(title, assigneeId);
      setTitle('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新しいタスクを入力..."
        className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
        disabled={isSubmitting}
      />
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 sm:w-48">
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
      <button
        type="submit"
        disabled={!title.trim() || isSubmitting}
        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Plus className="w-5 h-5" /><span>追加</span>
      </button>
    </form>
  );
};
