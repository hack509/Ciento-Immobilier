import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Heart, MessageSquare, Bell, Settings, LogOut, User, Menu, X,
  ShieldCheck, ClipboardCheck, Users, Flag, Plus, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useNotifications';
import { cn, getRoleLabel } from '@/lib/utils';

interface NavLink {
  icon: typeof LayoutDashboard;
  label: string;
  to: string;
  /** Match only the exact path (for section roots such as /dashboard and /admin). */
  exact?: boolean;
}

const ACCOUNT_LINKS: NavLink[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', to: '/dashboard', exact: true },
  { icon: Building2, label: 'Mes annonces', to: '/dashboard/annonces' },
  { icon: Heart, label: 'Favoris', to: '/dashboard/favoris' },
  { icon: MessageSquare, label: 'Messages', to: '/dashboard/messages' },
  { icon: Bell, label: 'Notifications', to: '/dashboard/notifications' },
  { icon: User, label: 'Profil', to: '/dashboard/profil' },
  { icon: Settings, label: 'Paramètres', to: '/dashboard/settings' },
];

const ADMIN_LINKS: NavLink[] = [
  { icon: ShieldCheck, label: 'Vue d’ensemble', to: '/admin', exact: true },
  { icon: ClipboardCheck, label: 'Modération', to: '/admin/annonces' },
  { icon: Users, label: 'Utilisateurs', to: '/admin/utilisateurs' },
  { icon: Flag, label: 'Signalements', to: '/admin/signalements' },
];

function Avatar({ firstName, lastName, avatarUrl }: { firstName?: string; lastName?: string; avatarUrl?: string }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-800 text-sm font-semibold text-white">
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadCount();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const isActive = (link: NavLink) =>
    link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const renderLink = (link: NavLink) => {
    const Icon = link.icon;
    const active = isActive(link);
    const badge = link.to === '/dashboard/notifications' && unreadCount > 0 ? unreadCount : 0;
    return (
      <Link
        key={link.to}
        to={link.to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-primary-800 text-white' : 'text-gray-600 hover:bg-primary-50 hover:text-primary-900'
        )}
      >
        <Icon className={cn('h-4.5 w-4.5', active ? 'text-secondary-400' : 'text-primary-400')} />
        {link.label}
        {badge > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary-500 px-1 text-xs font-bold text-primary-900">
            {badge > 9 ? '9+' : badge}
            <span className="sr-only"> non lues</span>
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 pr-10 lg:pr-0">
        <Avatar firstName={profile?.first_name} lastName={profile?.last_name} avatarUrl={profile?.avatar_url} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-primary-900">
            {profile?.first_name} {profile?.last_name}
          </div>
          <div className="text-xs text-gray-500">{profile ? getRoleLabel(profile.role) : ''}</div>
        </div>
      </div>

      <Link
        to="/dashboard/annonces/nouvelle"
        onClick={onNavigate}
        className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-secondary-500 px-4 text-sm font-semibold text-primary-900 shadow-sm transition-colors hover:bg-secondary-400"
      >
        <Plus className="h-4 w-4" />
        Publier une annonce
      </Link>

      <nav className="mt-4 flex-1 space-y-6" aria-label="Navigation du tableau de bord">
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Mon compte</p>
          <div className="space-y-1">{ACCOUNT_LINKS.map(renderLink)}</div>
        </div>
        {isAdmin && (
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-700">Administration</p>
            <div className="space-y-1">{ADMIN_LINKS.map(renderLink)}</div>
          </div>
        )}
      </nav>

      <div className="mt-6 space-y-1 border-t border-gray-100 pt-4">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-900"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-primary-400" />
          Retour au site
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-danger-600 hover:bg-danger-50"
        >
          <LogOut className="h-4.5 w-4.5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

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
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  // Focus the close button when the drawer opens; lock body scroll while open
  useEffect(() => {
    if (sidebarOpen) {
      requestAnimationFrame(() => {
        sidebarRef.current?.querySelector<HTMLElement>('[data-sidebar-close]')?.focus();
      });
    }
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-primary-800 hover:bg-gray-100"
          aria-label="Ouvrir le menu"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Ciento-Immobilier" className="h-8 w-auto rounded" />
        </Link>
        <div className="w-11" />
      </div>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', !sidebarOpen && 'pointer-events-none')} inert={!sidebarOpen}>
        <div
          className={cn('absolute inset-0 bg-primary-900/50 transition-opacity duration-300', sidebarOpen ? 'opacity-100' : 'opacity-0')}
          onClick={closeSidebar}
        />
        <aside
          ref={sidebarRef}
          id="dashboard-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Menu du tableau de bord"
          className={cn(
            'absolute bottom-0 left-0 top-0 w-72 overflow-y-auto bg-white p-4 shadow-xl transition-transform duration-300 ease-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <button
            data-sidebar-close
            type="button"
            onClick={closeSidebar}
            className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:text-gray-600"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={closeSidebar} />
        </aside>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card lg:sticky lg:top-8">
              <SidebarContent />
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
