import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { StatusBadge } from '@/components/billing/BillingUI';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { SERVICE_STATUS_LABELS, errorMessage } from '@/lib/monetization';
import { formatRelativeTime } from '@/lib/utils';
import type { ServiceRequest, ServiceRequestStatus } from '@/types/marketplace';

const STATUSES = Object.keys(SERVICE_STATUS_LABELS) as ServiceRequestStatus[];

function RequestCard({ request }: { request: ServiceRequest }) {
  const [notes, setNotes] = useState(request.admin_notes ?? '');
  const update = useAdminMutation((changes: { status?: ServiceRequestStatus; admin_notes?: string | null }) =>
    adminMarketplaceService.updateServiceRequest(request.id, changes));
  return (
    <li className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-primary-900">{request.category?.name} — {request.full_name}</p>
          <p className="text-xs text-gray-500">{formatRelativeTime(request.created_at)}{request.city ? ` · ${request.city}` : ''} · préfère : {request.preferred_contact}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={request.status} label={SERVICE_STATUS_LABELS[request.status]} />
          <select aria-label="Changer le statut" value={request.status} className="select-chevron rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            onChange={(e) => update.mutate({ status: e.target.value as ServiceRequestStatus })}>
            {STATUSES.map((s) => <option key={s} value={s}>{SERVICE_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{request.message}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <a href={`mailto:${request.email}`} className="flex items-center gap-1.5 text-brand-blue hover:underline"><Mail className="h-4 w-4" />{request.email}</a>
        <a href={`tel:${request.phone}`} className="flex items-center gap-1.5 text-brand-blue hover:underline"><Phone className="h-4 w-4" />{request.phone}</a>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes" maxLength={2000} aria-label="Notes internes"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <Button size="sm" variant="outline" disabled={notes === (request.admin_notes ?? '')} isLoading={update.isPending}
          onClick={() => update.mutate({ admin_notes: notes || null })}>Enregistrer</Button>
      </div>
      {update.isError && <p className="mt-2 text-xs text-danger-600">{errorMessage(update.error)}</p>}
    </li>
  );
}

export function AdminServices() {
  const [status, setStatus] = useState<ServiceRequestStatus | ''>('new');
  const requests = useAdminQuery(['service-requests', status], () => adminMarketplaceService.getServiceRequests(status));
  const categories = useAdminQuery(['service-categories'], () => adminMarketplaceService.getServiceCategories());
  const toggle = useAdminMutation((v: { id: string; is_active: boolean }) => adminMarketplaceService.saveServiceCategory(v));

  return (
    <div>
      <PageHeader title="Services immobiliers" subtitle="Demandes reçues et catalogue des services." />
      <div className="mb-4">
        <FilterTabs label="Statut" value={status} onChange={setStatus}
          options={[...STATUSES.map((s) => ({ value: s, label: SERVICE_STATUS_LABELS[s] })), { value: '' as const, label: 'Toutes' }]} />
      </div>
      <Panel>
        {requests.isLoading ? <LoadingSpinner className="py-16" /> : (requests.data || []).length === 0 ? (
          <EmptyState title="Aucune demande" description="Les demandes envoyées depuis les pages Services apparaissent ici." />
        ) : (
          <ul className="divide-y divide-gray-100">{(requests.data || []).map((r) => <RequestCard key={r.id} request={r} />)}</ul>
        )}
      </Panel>

      <Panel title="Catalogue" className="mt-6">
        <ul className="divide-y divide-gray-100">
          {(categories.data || []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div><p className="font-medium text-primary-900">{c.name}</p><p className="text-xs text-gray-500">/services/{c.slug}</p></div>
              <Switch label={c.is_active ? 'Publié' : 'Masqué'} checked={c.is_active} onChange={(v) => toggle.mutate({ id: c.id, is_active: v })} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
