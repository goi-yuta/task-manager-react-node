import React from 'react';
import { CheckCircle2, Folder, Plus, UserPlus, LogOut } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { type UserData, type ProjectData, type NotificationItem } from '../types';

interface HeaderProps {
  user: UserData;
  projects: ProjectData[];
  currentProjectId: number | null;
  setCurrentProjectId: (id: number) => void;
  unreadNotifications: number;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => Promise<void>;
  onNotificationClick: (notif: NotificationItem) => Promise<void>;
  onCreateProject: () => void;
  onInviteMember: () => void;
  onInviteUser: () => void;
  onLogout: () => void;
  isTenantOwner: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  projects,
  currentProjectId,
  setCurrentProjectId,
  unreadNotifications,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
  onCreateProject,
  onInviteMember,
  onInviteUser,
  onLogout,
  isTenantOwner
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5"/>
            </div>
            <span className="font-extrabold text-[11px] leading-tight hidden sm:block tracking-tight">
              TASK<br />MANAGER
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Folder className="w-4 h-4 text-slate-400" />
            <select
              value={currentProjectId || ''}
              onChange={(e) => setCurrentProjectId(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer max-w-[100px] sm:max-w-[150px] truncate"
            >
              {projects.length === 0 && <option value="">プロジェクトなし</option>}
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isTenantOwner && (
              <button onClick={onCreateProject} className="ml-1 p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="プロジェクト追加">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadNotifications}
            onMarkAllAsRead={onMarkAllAsRead}
            onNotificationClick={onNotificationClick}
          />

          {currentProjectId && (
            <button
              onClick={onInviteMember}
              className="flex items-center text-sm bg-indigo-50 text-indigo-600 p-2 lg:px-3 lg:py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-bold"
              title="メンバー管理"
            >
              <UserPlus className="w-4 h-4 lg:mr-1.5" />
              <span className="hidden lg:inline">メンバー管理</span>
            </button>
          )}

          {isTenantOwner && (
            <button
              onClick={onInviteUser}
              className="flex items-center text-sm bg-slate-100 text-slate-700 p-2 lg:px-3 lg:py-1.5 rounded-lg hover:bg-slate-200 transition-colors font-bold"
              title="組織に招待"
            >
              <UserPlus className="w-4 h-4 lg:mr-1.5" />
              <span className="hidden lg:inline">組織に招待</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 text-sm">
            <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="max-w-[80px] lg:max-w-none">
              <p className="font-bold text-slate-700 leading-tight truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400">ID: {user.tenant_id}</p>
            </div>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2" title="ログアウト">
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-bold hidden xl:block">ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  );
};
