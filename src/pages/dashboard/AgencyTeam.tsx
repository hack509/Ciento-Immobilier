import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAgencyMemberMutations, useAgencyMembers, useMyAgencies, useQuota } from '@/hooks/useMarketplace';
import { errorMessage } from '@/lib/monetization';
import type { AgencyMember, AgencyMemberRole } from '@/types/marketplace';

export function AgencyTeam() {
  const { data: agencies, isLoading: loadingAgency } = useMyAgencies();
  const membership = agencies?.[0];
  const agencyId = membership?.agency.id;
  const { data: members, isLoading } = useAgencyMembers(agencyId);
  const { data: quota } = useQuota(agencyId ?? null);
  const { add, update, remove } = useAgencyMemberMutations(agencyId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AgencyMemberRole>('agent');
  const [title, setTitle] = useState('');
  const [toRemove, setToRemove] = useState<AgencyMember | null>(null);

  if (loadingAgency) return <LoadingSpinner className="py-24" />;
  if (!membership) {
    return <EmptyState icon={<Users className="h-7 w-7" />} title="Aucune agence" description="Créez votre agence pour inviter des agents."
      action={<Link to="/dashboard/agence"><Button>Créer mon agence</Button></Link>} />;
  }
  if (!membership.canManageTeam) {
    return <Panel><p className="p-6 text-sm text-gray-600">Seuls le titulaire et les gestionnaires peuvent gérer l’équipe.</p></Panel>;
  }

  const activeCount = (members || []).filter((m) => m.is_active).length;
  const seatsLeft = quota?.member_limit == null ? null : Math.max(quota.member_limit - activeCount, 0);
  const toggle = (m: AgencyMember, field: 'can_publish' | 'can_manage_leads' | 'can_manage_billing' | 'is_active') =>
    update.mutate({ id: m.id, changes: { [field]: !m[field] } });

  return (
    <div>
      <PageHeader
        title="Équipe & agents"
        subtitle={seatsLeft === null ? 'Membres illimités avec votre formule.' : `${seatsLeft} place(s) disponible(s) avec votre formule.`}
        actions={<Link to="/dashboard/abonnement?espace=agence"><Button variant="outline">Augmenter les places</Button></Link>}
      />

      <Panel title="Ajouter un membre">
        <form
          className="grid gap-3 p-5 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ email, role, title }, { onSuccess: () => { setEmail(''); setTitle(''); } });
          }}
        >
          <Input label="E-mail du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required helperText="La personne doit déjà avoir un compte." />
          <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as AgencyMemberRole)}
            options={[{ value: 'agent', label: 'Agent' }, ...(membership.isOwner ? [{ value: 'manager', label: 'Gestionnaire' }] : [])]} />
          <Input label="Fonction (affichée)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Négociateur" />
          <Button type="submit" icon={<UserPlus className="h-4 w-4" />} isLoading={add.isPending} disabled={seatsLeft === 0}>Ajouter</Button>
        </form>
        {add.isError && <p role="alert" className="mx-5 mb-5 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(add.error)}</p>}
      </Panel>

      <Panel title="Membres" className="mt-6">
        {isLoading ? <LoadingSpinner className="py-12" /> : (members || []).length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Aucun membre pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(members || []).map((m) => (
              <li key={m.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary-900">{m.profile?.first_name} {m.profile?.last_name}
                    <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">{m.member_role === 'manager' ? 'Gestionnaire' : 'Agent'}</span>
                    {!m.is_active && <span className="ml-2 text-xs text-gray-400">(désactivé)</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">{m.profile?.email}{m.title ? ` · ${m.title}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <Switch checked={m.can_publish} onChange={() => toggle(m, 'can_publish')} label="Publier" />
                  <Switch checked={m.can_manage_leads} onChange={() => toggle(m, 'can_manage_leads')} label="Prospects" />
                  {membership.isOwner && <Switch checked={m.can_manage_billing} onChange={() => toggle(m, 'can_manage_billing')} label="Facturation" />}
                  <Switch checked={m.is_active} onChange={() => toggle(m, 'is_active')} label="Actif" />
                  <Button size="sm" variant="ghost" aria-label="Retirer le membre" onClick={() => setToRemove(m)}><Trash2 className="h-4 w-4 text-danger-600" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {update.isError && <p role="alert" className="m-5 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(update.error)}</p>}
      </Panel>

      <ConfirmDialog
        isOpen={!!toRemove}
        title="Retirer ce membre ?"
        description={`${toRemove?.profile?.first_name ?? ''} n’aura plus accès au portefeuille de l’agence. Ses annonces restent attachées à l’agence.`}
        confirmLabel="Retirer"
        tone="danger"
        isLoading={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && remove.mutate(toRemove.id, { onSuccess: () => setToRemove(null) })}
      />
    </div>
  );
}
