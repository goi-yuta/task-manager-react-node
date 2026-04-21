import { useState, useEffect, useCallback } from 'react';
import { type NotificationItem } from '../types';
import { useSocket } from '../contexts/SocketContext';

export const useNotifications = (apiFetch: any) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { socket } = useSocket();

  const fetchInitialData = useCallback(async () => {
    try {
      const [unreadRes, notificationsRes] = await Promise.all([
        apiFetch('/users/notifications/unread-count'),
        apiFetch('/users/notifications')
      ]);
      const unreadData = await unreadRes.json();
      const notificationsData = await notificationsRes.json();

      setUnreadNotifications(unreadData.count);
      setNotifications(notificationsData.notifications || []);
    } catch (err: any) {
      console.error('通知データの取得に失敗しました', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // WebSocket通知のリスン
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { unreadCount: number, notification: NotificationItem }) => {
      setUnreadNotifications(data.unreadCount);
      setNotifications(prev => [data.notification, ...prev]);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // 全て既読にする
  const markAllAsRead = async () => {
    if (unreadNotifications === 0) return;
    try {
      await apiFetch('/users/notifications/read', { method: 'POST' });
      setUnreadNotifications(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      console.error('既読処理に失敗しました', err);
    }
  };

  // 特定タスクの通知を既読にする
  const markTaskAsRead = useCallback(async (taskId: number) => {
    try {
      await apiFetch(`/users/notifications/tasks/${taskId}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.task_id === taskId ? { ...n, is_read: true } : n));

      const res = await apiFetch('/users/notifications/unread-count');
      const data = await res.json();
      setUnreadNotifications(data.count);
    } catch (err: any) {
      console.error('既読処理に失敗しました', err);
    }
  }, [apiFetch]);

  return {
    notifications,
    unreadNotifications,
    markAllAsRead,
    markTaskAsRead,
    refreshNotifications: fetchInitialData
  };
};
