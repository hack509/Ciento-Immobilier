import { useState } from 'react';
import { Search, BadgeCheck, Users } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks';
import { useAdminUsers, useUpdateUser } from '@/hooks/useAdmin';
import { cn, getRoleLabel } from '@/lib/utils';
import type { Profile, UserRole } from '@/types';

const ALL_ROLES: UserRole[] = ['client', 'owner', 'agent', 'agency', 'admin', 'super_admin'];
const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const selectClass =
  'select-chevron w-full appearance-none rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-900 ' +
  'focus:border-secondary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-secondary-500/25 disabled:cursor-not-allowed disabled:opacity-60';

function UserRow({ user, currentUser }: { user: Profile; currentUser: Profile | null }) {
  const updateUser = useUpdateUser();
  const isSelf = user.id === currentUser?.id;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  // Mirrors the DB trigger: only a super_admin manages admin roles; nobody edits their own account here
  const canEditRole = !isSelf && (isSuperAdmin || !ADMIN_ROLES.includes(user.role));
  const roleOptions = isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => !ADMIN_ROLES.includes(r));
  const busy = updateUser.isPending;

  return (
    <tr className="align-middle">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-800 text-sm font-semibold text-white">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-primary-900">
              {user.first_name} {user.last_name}
              {user.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-secondary-600" aria-label="Compte vérifié" />}
              {isSelf && <span className="ml-1 rounded bg-primary-50 px-1.5 text-[11px] font-semibold text-primary-700">Vous</span>}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        {updateUser.isError && (
          <p role="alert" className="mt-1 text-xs text-danger-600">
            {updateUser.error instanceof Error ? updateUser.error.message : 'Modification refusée.'}
          </p>
        )}
      </td>
      <td className="px-4 py-4">
        {canEditRole ? (
          <select
            value={user.role}
            disabled={busy}
            onChange={(e) => updateUser.mutate({ userId: user.id, changes: { role: e.target.value as UserRole } })}
            aria-label={`Rôle de ${user.first_name} ${user.last_name}`}
            className={cn(selectClass, 'min-w-[11.5rem]')}
          >
            {(roleOptions.includes(user.role) ? roleOptions : [user.role, ...roleOptions]).map((role) => (
              <option key={role} value={role}>{getRoleLabel(role)}</option>
            ))}
          </select>
        ) : (
          <span className="whitespace-nowrap text-sm font-medium text-primary-800">{getRoleLabel(user.role)}</span>
        )}
      </td>
      <td className="px-4 py-4">
        <Switch
          checked={user.is_verified}
          disabled={busy || isSelf}
          onChange={(checked) => updateUser.mutate({ userId: user.id, changes: { is_verified: checked } })}
          label={user.is_verified ? 'Vérifié' : 'Non vérifié'}
          className="whitespace-nowrap"
        />
      </td>
      <td className="px-4 py-4">
        <Switch
          checked={user.is_active}
          disabled={busy || isSelf}
          onChange={(checked) => updateUser.mutate({ userId: user.id, changes: { is_active: checked } })}
          label={user.is_active ? 'Actif' : 'Désactivé'}
          className="whitespace-nowrap"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{shortDate.format(new Date(user.created_at))}</td>
    </tr>
  );
}

export function AdminUsers() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);
  const query = useDebounce(search.trim(), 350);
  const { data, isLoading } = useAdminUsers({ query, role, page });

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={data ? `${data.count} compte${data.count > 1 ? 's' : ''}` : 'Rôles, vérification et accès des comptes.'}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Nom ou email…"
            aria-label="Rechercher un utilisateur"
            className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-900 focus:border-secondary-500 focus:outline-none focus:ring-4 focus:ring-secondary-500/25"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as UserRole | ''); setPage(1); }}
          aria-label="Filtrer par rôle"
          className={cn(selectClass, 'py-2.5 sm:w-56', role && 'border-secondary-500 bg-secondary-50')}
        >
          <option value="">Tous les rôles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </select>
      </div>

      <Panel className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead className="bg-primary-50/60 text-xs font-semibold uppercase tracking-wider text-primary-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Utilisateur</th>
                  <th scope="col" className="px-4 py-3">Rôle</th>
                  <th scope="col" className="px-4 py-3">Vérification</th>
                  <th scope="col" className="px-4 py-3">Accès</th>
                  <th scope="col" className="px-4 py-3">Inscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((user) => <UserRow key={user.id} user={user} currentUser={profile} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Aucun utilisateur" description="Aucun compte ne correspond à cette recherche." />
        )}
      </Panel>

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} className="mt-8" />
      )}
    </div>
  );
}
