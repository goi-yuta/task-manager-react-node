import React from 'react';
import { TASK_STATUS, type ProjectMember } from '../types';
import { Search, Filter } from 'lucide-react';

interface TaskFilterBarProps {
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterAssignee: string;
  setFilterAssignee: (val: string) => void;
  filterKeyword: string;
  setFilterKeyword: (val: string) => void;
  executeSearch: () => void;
  clearFilters: () => void;
  projectMembers: ProjectMember[];
  currentUserId: number;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  filterStatus, setFilterStatus,
  filterAssignee, setFilterAssignee,
  filterKeyword, setFilterKeyword,
  executeSearch, clearFilters,
  projectMembers, currentUserId
}) => {

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mr-2">
        <Filter className="w-4 h-4" /> 絞り込み:
      </div>

      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
      >
        <option value="">すべてのステータス</option>
        <option value={TASK_STATUS.TODO}>未着手 (TODO)</option>
        <option value={TASK_STATUS.DOING}>進行中 (DOING)</option>
        <option value={TASK_STATUS.DONE}>完了 (DONE)</option>
      </select>

      <select
        value={filterAssignee}
        onChange={(e) => setFilterAssignee(e.target.value)}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
      >
        <option value="">すべての担当者</option>
        <option value="me" className="font-bold text-indigo-600">👤 自分のタスク</option>
        <option value="unassigned" className="text-slate-400">❓ 未割り当て</option>
        <optgroup label="プロジェクトメンバー">
          {projectMembers
            .filter(u => u.id !== currentUserId)
            .map(u => (
            <option key={u.id} value={u.id.toString()}>{u.name}</option>
          ))}
        </optgroup>
      </select>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="タスク名や説明文で検索... (Enterで実行)"
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              executeSearch();
            }
          }}
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {(filterStatus || filterAssignee || filterKeyword) && (
        <button
          onClick={clearFilters}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
        >
          条件をクリア
        </button>
      )}
    </div>
  );
};
