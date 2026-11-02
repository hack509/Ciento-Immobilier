import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { cn, formatRelativeTime } from '@/lib/utils';

export function Notifications() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Chargement..." className="py-20" />;
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 sm:text-3xl">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            icon={<CheckCheck className="w-4 h-4" />}
          >
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                'px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3',
                !notif.is_read && 'bg-secondary-50/30'
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full mt-2 shrink-0',
                notif.is_read ? 'bg-gray-300' : 'bg-secondary-500'
              )} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-primary-900 text-sm">{notif.title}</div>
                <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                <span className="text-xs text-gray-400 mt-1 block">{formatRelativeTime(notif.created_at)}</span>
                {notif.link?.startsWith('/') && (
                  <Link
                    to={notif.link}
                    onClick={() => !notif.is_read && markRead.mutate(notif.id)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-900"
                  >
                    Voir <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
              {!notif.is_read && (
                <button
                  onClick={() => markRead.mutate(notif.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-700 hover:bg-secondary-50 transition-colors shrink-0"
                  title="Marquer comme lu"
                  aria-label="Marquer comme lu"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title="Aucune notification"
          description="Vous serez notifié des nouveaux messages, rendez-vous et mises à jour."
        />
      )}
    </div>
  );
}
