import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Ban, RotateCcw, ExternalLink } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { DataTable } from '@/components/billing/BillingUI';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { errorMessage } from '@/lib/monetization';
import { formatDate } from '@/lib/utils';
import type { Agency } from '@/types';

type Filter = 'pending' | 'verified' | 'suspended' | '';
type Decision = { agency: Agency; verified: boolean; active: boolean; label: string; danger?: boolean };

export function AdminAgencies() {
  const [filter, setFilter] = useState<Filter>('pending');
  const { data: agencies, isLoading } = useAdminQuery(['agencies', filter], () => adminMarketplaceService.getAgencies(filter));
  const setStatus = useAdminMutation((v: { id: string; verified: boolean; active: boolean; note?: string }) =>
    adminMarketplaceService.setAgencyStatus(v.id, v.verified, v.active, v.note));
  const [decision, setDecision] = useState<Decision | null>(null);

  return (
    <div>
      <PageHeader title="Agences" subtitle="Validation, suspension et suivi des agences immobilières." />
      <div className="mb-4">
        <FilterTabs label="Statut" value={filter} onChange={setFilter} options={[
          { value: 'pending', label: 'À valider' }, { value: 'verified', label: 'Validées' },
          { value: 'suspended', label: 'Suspendues' }, { value: '', label: 'Toutes' },
        ]} />
      </div>
      <Panel>
        {isLoading ? <LoadingSpinner className="py-16" /> : (
          <DataTable headers={['Agence', 'Titulaire', 'Contact', 'Demande', 'Statut', 'Actions']}
            empty={(agencies || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune agence.</p> : null}>
            {(agencies || []).map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-primary-900">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.license_number ? `Licence ${a.license_number}` : 'Licence non renseignée'} · {a.properties_count} annonce(s)</p>
                </td>
                <td className="px-5 py-3 text-xs">{a.owner?.first_name} {a.owner?.last_name}<br /><span className="text-gray-500">{a.owner?.email}</span></td>
                <td className="px-5 py-3 text-xs">{a.phone}<br />{a.email}</td>
                <td className="px-5 py-3 text-xs">{a.verification_requested_at ? formatDate(a.verification_requested_at) : formatDate(a.created_at)}</td>
                <td className="px-5 py-3">
                  {!a.is_active ? <Badge variant="danger">Suspendue</Badge> : a.is_verified ? <Badge variant="success">Validée</Badge> : <Badge variant="warning">En attente</Badge>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {a.is_active && !a.is_verified && (
                      <Button size="sm" icon={<BadgeCheck className="h-4 w-4" />} onClick={() => setDecision({ agency: a, verified: true, active: true, label: 'Valider l’agence' })}>Valider</Button>
                    )}
                    {a.is_active ? (
                      <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setDecision({ agency: a, verified: a.is_verified, active: false, label: 'Suspendre l’agence', danger: true })}>Suspendre</Button>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setDecision({ agency: a, verified: a.is_verified, active: true, label: 'Réactiver l’agence' })}>Réactiver</Button>
                    )}
                    {a.is_verified && <Link to={`/agences/${a.slug}`} target="_blank" className="p-2 text-gray-400 hover:text-brand-blue" aria-label="Page publique"><ExternalLink className="h-4 w-4" /></Link>}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <ConfirmDialog
        isOpen={!!decision}
        title={decision?.label ?? ''}
        description={decision ? `Agence « ${decision.agency.name} ». Le titulaire sera notifié et l’action sera journalisée.` : ''}
        inputLabel={decision?.danger ? 'Motif (communiqué au titulaire)' : undefined}
        tone={decision?.danger ? 'danger' : 'primary'}
        confirmLabel="Confirmer"
        isLoading={setStatus.isPending}
        error={setStatus.isError ? errorMessage(setStatus.error) : null}
        onClose={() => setDecision(null)}
        onConfirm={(note) => decision && setStatus.mutate(
          { id: decision.agency.id, verified: decision.verified, active: decision.active, note: note || undefined },
          { onSuccess: () => setDecision(null) })}
      />
    </div>
  );
}
