import { Link } from 'react-router-dom';
import { Users, Building2, Clock, Flag, Mail, ArrowRight, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader, Panel, StatCard } from '@/components/dashboard/DashboardUI';
import { useAdminStats, useModerationQueue } from '@/hooks/useAdmin';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

export function AdminOverview() {
  const { data: stats, isError } = useAdminStats();
  const { data: pending, isLoading } = useModerationQueue({ status: 'pending', page: 1 });
  const preview = pending?.data.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader title="Administration" subtitle="Vue d’ensemble de la plateforme Ciento-Immobilier." />

      {isError && (
        <p role="alert" className="mb-6 rounded-xl bg-danger-50 p-4 text-sm text-danger-600">
          Impossible de charger les statistiques. Vérifiez que votre compte a bien le rôle administrateur.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Clock} tone="gold" label="En attente" value={stats?.pendingListings} to="/admin/annonces" hint="Annonces à valider" />
        <StatCard icon={Building2} tone="navy" label="Annonces en ligne" value={stats?.activeListings} to="/admin/annonces?status=active" />
        <StatCard icon={Users} label="Utilisateurs" value={stats?.users} to="/admin/utilisateurs" />
        <StatCard icon={Flag} tone="warning" label="Signalements ouverts" value={stats?.openReports} to="/admin/signalements" />
        <StatCard icon={Mail} label="Abonnés newsletter" value={stats?.newsletterSubscribers} />
      </div>

      <Panel
        title="File de modération"
        action={
          <Link to="/admin/annonces" className="text-sm font-semibold text-primary-700 hover:text-primary-900">
            Tout voir
          </Link>
        }
      >
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : preview.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100">
              {preview.map((property) => (
                <li key={property.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary-900">{property.title}</p>
                    <p className="text-xs text-gray-500">
                      {property.owner ? `${property.owner.first_name} ${property.owner.last_name} · ` : ''}
                      {formatPrice(property.price, property.price_currency)} · {formatRelativeTime(property.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 p-4">
              <Link to="/admin/annonces">
                <Button className="w-full sm:w-auto" icon={<ClipboardCheck className="h-4 w-4" />}>
                  Modérer les annonces
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="font-semibold text-primary-900">Tout est à jour</p>
            <p className="mt-1 text-sm text-gray-500">Aucune annonce n’attend de validation.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
