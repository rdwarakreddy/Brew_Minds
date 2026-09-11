/**
 * NotificationBell.jsx
 * ---------------------------------------------------------------------
 * The bell icon at the top of the sidebar. Polls the unread count every
 * 30s (cheap: it's a single COUNT query) so the badge stays fresh even
 * if the user leaves the tab open for a while, e.g. waiting for a
 * meeting reminder created by notificationService's background job.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../api/notifications';
import { useToast, getErrorMessage } from '../../context/ToastContext';

export default function NotificationBell() {
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const refreshCount = async () => {
    try {
      setUnreadCount(await notificationsApi.unreadCount());
    } catch {
      /* silent -- a failed badge refresh shouldn't disrupt the UI */
    }
  };

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openDropdown = async () => {
    setIsOpen((v) => !v);
    if (!isOpen) {
      try {
        const list = await notificationsApi.list();
        setNotifications(list);
      } catch (err) {
        showError(getErrorMessage(err));
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={openDropdown}
        className="relative rounded-full p-2 text-ink-invert/70 transition-colors hover:bg-panel-raised hover:text-ink-invert"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brass px-1 text-[10px] font-semibold text-panel">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 rounded-xl border border-line bg-canvas shadow-popover dark:border-line-dark dark:bg-canvas-dark">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
            <p className="text-sm font-medium text-ink dark:text-ink-invert">Notifications</p>
            <button onClick={handleMarkAllRead} className="text-xs text-brass hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-soft dark:text-ink-invert/60">
                You're all caught up.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-line px-4 py-3 last:border-b-0 dark:border-line-dark ${
                    n.isRead ? '' : 'bg-brass/5'
                  }`}
                >
                  <p className="text-sm font-medium text-ink dark:text-ink-invert">{n.title}</p>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-ink-soft dark:text-ink-invert/60">{n.message}</p>
                  )}
                  <p className="mt-1 text-[11px] text-ink-soft/70">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
