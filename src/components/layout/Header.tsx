import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Heart, Home, Building2, Phone, ChevronDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { profile, isAuthenticated, signOut } = useAuth();

  const navLinks = [
    { to: '/', label: 'Accueil', icon: Home },
    { to: '/annonces', label: 'Acheter', icon: Building2 },
    { to: '/louer', label: 'Louer', icon: Building2 },
    { to: '/vendre', label: 'Vendre', icon: Building2 },
    { to: '/airbnb', label: 'Airbnb', icon: Home },
    { to: '/agents', label: 'Agents', icon: User },
    { to: '/contact', label: 'Contact', icon: Phone },
  ];

  const isActive = (path: string) => location.pathname === path;

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  // Escape key + focus trapping for mobile drawer
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        menuToggleRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
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
  }, [mobileMenuOpen, closeMenu]);

  // Focus close button when drawer opens
  useEffect(() => {
    if (mobileMenuOpen) {
      requestAnimationFrame(() => {
        drawerRef.current?.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
      });
    }
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close menus on route change
  useEffect(() => {
    closeMenu();
    setProfileOpen(false);
  }, [location.pathname, closeMenu]);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 min-h-[44px]">
            <img
              src="/logo.jpg"
              alt="Ciento-Immobilier"
              className="h-10 w-auto rounded-lg object-contain"
            />
            <div className="hidden sm:block">
              <span className="text-primary-800 font-bold text-lg leading-tight block">
                Ciento
              </span>
              <span className="text-secondary-500 font-semibold text-[11px] leading-tight block -mt-0.5">
                Immobilier
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center',
                  isActive(link.to)
                    ? 'text-primary-700 bg-primary-50'
                    : 'text-gray-600 hover:text-primary-700 hover:bg-gray-50'
                )}
                aria-current={isActive(link.to) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/annonces"
              className="p-2.5 rounded-lg text-gray-500 hover:text-primary-700 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              to="/dashboard/favoris"
              className="p-2.5 rounded-lg text-gray-500 hover:text-primary-700 hover:bg-gray-100 transition-colors hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center"
              title="Favoris"
              aria-label="Favoris"
            >
              <Heart className="w-5 h-5" />
            </Link>

            {isAuthenticated ? (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px]"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                  aria-label="Menu du profil"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 bg-primary-700 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium">{profile?.first_name}</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', profileOpen && 'rotate-180')} />
                </button>
                {profileOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                    role="menu"
                    aria-label="Options du profil"
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{profile?.first_name} {profile?.last_name}</div>
                      <div className="text-xs text-gray-500">{profile?.email}</div>
                    </div>
                    <Link to="/dashboard" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]" role="menuitem">
                      Dashboard
                    </Link>
                    <Link to="/dashboard/annonces" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]" role="menuitem">
                      Mes annonces
                    </Link>
                    <Link to="/dashboard/profil" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]" role="menuitem">
                      Mon profil
                    </Link>
                    {profile?.role === 'admin' || profile?.role === 'super_admin' ? (
                      <Link to="/admin" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]" role="menuitem">
                        Administration
                      </Link>
                    ) : null}
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => { setProfileOpen(false); signOut(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-danger-500 hover:bg-gray-50 min-h-[44px]"
                      role="menuitem"
                    >
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/auth/connexion"
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-700 transition-colors min-h-[44px] flex items-center"
                >
                  Connexion
                </Link>
                <Link
                  to="/auth/inscription"
                  className="px-3 sm:px-4 py-2 bg-secondary-500 text-white text-sm font-semibold rounded-lg hover:bg-secondary-600 transition-colors shadow-sm min-h-[44px] flex items-center"
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}

            {/* Mobile Menu Button — Animated Hamburger */}
            <button
              ref={menuToggleRef}
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              <div className="w-5 h-5 relative">
                <span
                  className={cn(
                    'absolute left-0 w-full h-0.5 bg-current rounded transition-all duration-300',
                    mobileMenuOpen
                      ? 'top-1/2 -translate-y-1/2 rotate-45'
                      : 'top-0'
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 top-1/2 w-full h-0.5 bg-current rounded -translate-y-1/2 transition-all duration-300',
                    mobileMenuOpen && 'opacity-0'
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 w-full h-0.5 bg-current rounded transition-all duration-300',
                    mobileMenuOpen
                      ? 'top-1/2 -translate-y-1/2 -rotate-45'
                      : 'bottom-0'
                  )}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile Menu Drawer — right-side panel */}
      <div
        ref={drawerRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation mobile"
        className={cn(
          'lg:hidden fixed top-0 right-0 bottom-0 z-50 w-72 sm:w-80 bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 min-h-[44px]" onClick={closeMenu}>
            <img src="/logo.jpg" alt="Ciento-Immobilier" className="h-8 w-auto rounded-lg object-contain" />
            <span className="text-primary-800 font-bold text-lg">Ciento</span>
          </Link>
          <button
            data-drawer-close
            onClick={closeMenu}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fermer le menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Profile Section (authenticated) */}
        {isAuthenticated && (
          <div className="px-4 py-4 border-b border-gray-100 shrink-0">
            <Link
              to="/dashboard/profil"
              onClick={closeMenu}
              className="flex items-center gap-3 min-h-[44px]"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {profile?.first_name} {profile?.last_name}
                </div>
                <div className="text-xs text-gray-500 truncate">{profile?.email}</div>
              </div>
            </Link>
          </div>
        )}

        {/* Dashboard Quick Links (authenticated) */}
        {isAuthenticated && (
          <div className="px-4 pt-3 pb-1 border-b border-gray-100 shrink-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mon compte</div>
            <div className="space-y-0.5">
              <Link
                to="/dashboard"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-700 transition-colors min-h-[44px]"
              >
                Dashboard
              </Link>
              <Link
                to="/dashboard/annonces"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-700 transition-colors min-h-[44px]"
              >
                Mes annonces
              </Link>
              <Link
                to="/dashboard/favoris"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-700 transition-colors min-h-[44px]"
              >
                Favoris
              </Link>
              {profile?.role === 'admin' || profile?.role === 'super_admin' ? (
                <Link
                  to="/admin"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-700 transition-colors min-h-[44px]"
                >
                  Administration
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {isAuthenticated ? 'Navigation' : 'Menu'}
          </div>
          <div className="space-y-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMenu}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                    isActive(link.to)
                      ? 'text-primary-700 bg-primary-50'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-primary-700'
                  )}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Section (unauthenticated) */}
        {!isAuthenticated && (
          <div className="px-4 py-4 border-t border-gray-100 shrink-0 space-y-2">
            <Link
              to="/auth/connexion"
              onClick={closeMenu}
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
            >
              Connexion
            </Link>
            <Link
              to="/auth/inscription"
              onClick={closeMenu}
              className="flex items-center justify-center w-full px-4 py-3 bg-secondary-500 text-white text-sm font-semibold rounded-lg hover:bg-secondary-600 transition-colors min-h-[44px]"
            >
              S&apos;inscrire
            </Link>
          </div>
        )}

        {/* Bottom Section (authenticated) */}
        {isAuthenticated && (
          <div className="px-4 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={() => { closeMenu(); signOut(); }}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-danger-500 hover:bg-danger-50 rounded-lg transition-colors min-h-[44px]"
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
