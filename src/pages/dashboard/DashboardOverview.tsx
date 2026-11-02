import { Link } from 'react-router-dom';
import { Building2, Clock, Heart, MessageSquare, Plus, Search, ShieldCheck, ArrowRight, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader, Panel, StatCard } from '@/components/dashboard/DashboardUI';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnProperties } from '@/hooks/useProperties';
import { useUserDashboardStats, useAdminStats } from '@/hooks/useAdmin';
import { formatPrice, formatRelativeTime, getStatusColor, getStatusLabel } from '@/lib/utils';

function AdminShortcut() {
  const { data: stats } = useAdminStats();
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-primary-900 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-500 text-primary-900">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-white">Espace administration</p>
          <p className="text-sm text-primary-200">
            {stats?.pendingListings
              ? `${stats.pendingListings} annonce${stats.pendingListings > 1 ? 's' : ''} en attente de validation`
              : 'Aucune annonce en attente de validation'}
          </p>
        </div>
      </div>
      <Link to={stats?.pendingListings ? '/admin/annonces' : '/admin'}>
        <Button>
          {stats?.pendingListings ? 'Modérer maintenant' : 'Ouvrir'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

export function DashboardOverview() {
  const { profile } = useAuth();
  const { data: stats } = useUserDashboardStats(profile?.id);
  const { data: ownProperties, isLoading } = useOwnProperties(profile?.id);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const recent = ownProperties?.data.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${profile?.first_name ?? ''}`}
        subtitle="Voici un aperçu de votre activité."
        actions={
          <Link to="/dashboard/annonces/nouvelle">
            <Button icon={<Plus className="h-4 w-4" />}>Publier une annonce</Button>
          </Link>
        }
      />

      {isAdmin && <AdminShortcut />}

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Building2} tone="navy" label="Annonces en ligne" value={stats?.activeListings} to="/dashboard/annonces" />
        <StatCard icon={Clock} tone="warning" label="En attente de validation" value={stats?.pendingListings} to="/dashboard/annonces" />
        <StatCard icon={Heart} label="Favoris" value={stats?.favorites} to="/dashboard/favoris" />
        <StatCard icon={MessageSquare} tone="gold" label="Messages non lus" value={stats?.unreadMessages} to="/dashboard/messages" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Mes dernières annonces"
          className="xl:col-span-2"
          action={recent.length > 0 && (
            <Link to="/dashboard/annonces" className="text-sm font-semibold text-primary-700 hover:text-primary-900">
              Tout voir
            </Link>
          )}
        >
          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
            </div>
          ) : recent.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recent.map((property) => {
                const image = property.images?.find((img) => img.is_primary) || property.images?.[0];
                return (
                  <li key={property.id}>
                    <Link
                      to={`/dashboard/annonces/${property.id}/modifier`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-primary-50">
                        {image ? (
                          <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-primary-300"><ImageOff className="h-5 w-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary-900">{property.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatPrice(property.price, property.price_currency)} · {formatRelativeTime(property.created_at)}
                        </p>
                      </div>
                      <Badge variant={getStatusColor(property.status)}>{getStatusLabel(property.status)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-semibold text-primary-900">Vous n’avez pas encore d’annonce</p>
              <p className="mt-1 text-sm text-gray-500">Publiez votre premier bien : il sera vérifié par notre équipe avant sa mise en ligne.</p>
              <Link to="/dashboard/annonces/nouvelle" className="mt-4 inline-block">
                <Button icon={<Plus className="h-4 w-4" />}>Publier une annonce</Button>
              </Link>
            </div>
          )}
        </Panel>

        <Panel title="Raccourcis">
          <div className="space-y-2 p-3">
            {[
              { to: '/annonces', icon: Search, label: 'Rechercher un bien', desc: 'Parcourir les annonces en ligne' },
              { to: '/dashboard/messages', icon: MessageSquare, label: 'Mes messages', desc: 'Répondre aux acheteurs et propriétaires' },
              { to: '/dashboard/profil', icon: Building2, label: 'Compléter mon profil', desc: 'Téléphone et présentation' },
            ].map(({ to, icon: Icon, label, desc }) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-primary-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-50 text-secondary-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-primary-900">{label}</span>
                  <span className="block text-xs text-gray-500">{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
