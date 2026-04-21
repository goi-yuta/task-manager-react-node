import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { type NotificationItem } from '../types';
import { formatActivityMessage } from '../utils/formatters';

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAllAsRead: () => Promise<void>;
  onNotificationClick: (notif: NotificationItem) => Promise<void>;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onNotificationClick
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
        title="通知"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-30 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">通知</h3>
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold transition-colors"
              >
                すべて既読にする
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">通知はありません</div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setIsOpen(false);
                      onNotificationClick(n);
                    }}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 flex gap-3 relative ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                  >
                    {!n.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 font-bold text-xs uppercase">
                      {n.actor_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">
                        {formatActivityMessage(n.action, n.details, n.actor_name)}
                      </p>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5 truncate">
                        「{n.task_title}」
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
