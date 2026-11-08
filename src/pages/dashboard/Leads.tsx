import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Mail, Phone, ExternalLink } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { ScopeSwitcher } from '@/components/billing/BillingUI';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAccountScope, useInquiries, useUpdateInquiry } from '@/hooks/useMarketplace';
import { INQUIRY_STATUS_LABELS, errorMessage, statusTone } from '@/lib/monetization';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { InquiryStatus } from '@/types/marketplace';

const STATUSES = Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[];
const toneClass: Record<string, string> = {
  success: 'bg-success-50 text-success-700', warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-600', primary: 'bg-primary-100 text-primary-800', default: 'bg-gray-100 text-gray-700',
};

export function Leads() {
  const scope = useAccountScope();
  const [status, setStatus] = useState<InquiryStatus | ''>('');
  const { data: inquiries, isLoading } = useInquiries(scope.agencyId, status);
  const update = useUpdateInquiry();

  return (
    <div>
      <PageHeader
        title="Contacts & prospects"
        subtitle="Les demandes envoyées par les visiteurs depuis vos annonces."
        actions={<ScopeSwitcher agencyName={scope.membership?.canManageLeads ? scope.membership.agency.name : undefined} isAgencyScope={scope.isAgencyScope} onChange={scope.setScope} />}
      />
      <div className="mb-4">
        <FilterTabs
          label="Filtrer par statut"
          value={status}
          onChange={setStatus}
          options={[{ value: '' as const, label: 'Tous' }, ...STATUSES.map((s) => ({ value: s, label: INQUIRY_STATUS_LABELS[s] }))]}
        />
      </div>
      {update.isError && <p role="alert" className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(update.error)}</p>}
      <Panel>
        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : !inquiries || inquiries.length === 0 ? (
          <EmptyState icon={<Inbox className="h-7 w-7" />} title="Aucune demande pour le moment" description="Les demandes de contact de vos annonces apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {inquiries.map((inquiry) => (
              <li key={inquiry.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-900">{inquiry.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(inquiry.created_at)}
                      {inquiry.property && (
                        <> · <Link className="inline-flex items-center gap-1 hover:text-brand-blue" to={`/annonces/${inquiry.property.city?.slug ?? 'inconnu'}/${inquiry.property.slug}`}>
                          {inquiry.property.title}<ExternalLink className="h-3 w-3" />
                        </Link></>
                      )}
                    </p>
                  </div>
                  <label className="shrink-0">
                    <span className="sr-only">Statut</span>
                    <select
                      value={inquiry.status}
                      onChange={(e) => update.mutate({ id: inquiry.id, changes: { status: e.target.value as InquiryStatus } })}
                      className={cn('select-chevron rounded-lg border-0 px-3 py-1.5 text-xs font-semibold', toneClass[statusTone(inquiry.status)] ?? toneClass.default)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{inquiry.message}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1.5 font-medium text-brand-blue hover:underline"><Mail className="h-4 w-4" />{inquiry.email}</a>
                  {inquiry.phone && <a href={`tel:${inquiry.phone}`} className="flex items-center gap-1.5 font-medium text-brand-blue hover:underline"><Phone className="h-4 w-4" />{inquiry.phone}</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
