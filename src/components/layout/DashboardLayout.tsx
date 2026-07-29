import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Heart, MessageSquare, Bell, Settings, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const sidebarLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: Building2, label: 'Mes annonces', to: '/dashboard/annonces' },
  { icon: Heart, label: 'Favoris', to: '/dashboard/favoris' },
  { icon: MessageSquare, label: 'Messages', to: '/dashboard/messages' },
  { icon: Bell, label: 'Notifications', to: '/dashboard/notifications' },
  { icon: User, label: 'Profil', to: '/dashboard/profil' },
  { icon: Settings, label: 'Paramètres', to: '/dashboard/settings' },
];

export function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadCount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Escape key + focus trapping for mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSidebar();
        toggleRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && sidebarRef.current) {
        const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  // Focus sidebar when opened
  useEffect(() => {
    if (sidebarOpen) {
      requestAnimationFrame(() => {
        sidebarRef.current?.querySelector<HTMLElement>('[data-sidebar-close]')?.focus();
      });
    }
  }, [sidebarOpen]);

  // Body scroll lock
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Close sidebar on route change
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          ref={toggleRef}
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Ouvrir le menu latéral"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Ciento" className="h-8 w-auto rounded" />
          <span className="font-bold text-primary-800">Dashboard</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile Sidebar Overlay + Drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-50',
          sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!sidebarOpen}
      >
        {/* Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-300',
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={closeSidebar}
        />
        {/* Drawer */}
        <aside
          ref={sidebarRef}
          id="dashboard-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation du tableau de bord"
          className={cn(
            'absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl transition-transform duration-300 ease-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium text-sm">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{profile?.first_name} {profile?.last_name}</div>
                <div className="text-xs text-gray-500">{profile?.role}</div>
              </div>
            </div>
            <button
              data-sidebar-close
              onClick={closeSidebar}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 space-y-1" aria-label="Navigation du tableau de bord">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              const hasUnread = link.to === '/dashboard/notifications' && unreadCount && unreadCount > 0;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeSidebar}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative min-h-[44px]',
                    active
                      ? 'bg-secondary-50 text-secondary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-primary-700'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                  {hasUnread && (
                    <span className="absolute right-3 w-5 h-5 bg-secondary-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-danger-500 hover:bg-danger-50 transition-colors mt-2 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </nav>
        </aside>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:sticky lg:top-24">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium min-h-[44px] min-w-[44px]">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{profile?.first_name} {profile?.last_name}</div>
                  <div className="text-xs text-gray-500">{profile?.role}</div>
                </div>
              </div>
              <nav className="space-y-1" aria-label="Navigation du tableau de bord">
                {sidebarLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.to);
                  const hasUnread = link.to === '/dashboard/notifications' && unreadCount && unreadCount > 0;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative min-h-[44px]',
                      active
                        ? 'bg-secondary-50 text-secondary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-primary-700'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                    {hasUnread && (
                      <span className="absolute right-3 w-5 h-5 bg-secondary-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-danger-500 hover:bg-danger-50 transition-colors mt-2 min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </button>
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
