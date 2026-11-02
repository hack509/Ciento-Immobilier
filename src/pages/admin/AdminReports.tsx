import { useState } from 'react';
import { Flag, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, FilterTabs } from '@/components/dashboard/DashboardUI';
import { useAdminReports, useUpdateReport } from '@/hooks/useAdmin';
import { formatRelativeTime } from '@/lib/utils';
import type { Report } from '@/types';

type ReportStatus = Report['status'];

const STATUS_TABS: { value: ReportStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Nouveaux' },
  { value: 'reviewed', label: 'En cours' },
  { value: 'resolved', label: 'Résolus' },
  { value: 'dismissed', label: 'Rejetés' },
  { value: '', label: 'Tous' },
];

const STATUS_BADGE: Record<ReportStatus, { label: string; variant: 'warning' | 'primary' | 'success' | 'default' }> = {
  pending: { label: 'Nouveau', variant: 'warning' },
  reviewed: { label: 'En cours', variant: 'primary' },
  resolved: { label: 'Résolu', variant: 'success' },
  dismissed: { label: 'Rejeté', variant: 'default' },
};

const TARGET_LABELS: Record<Report['target_type'], string> = {
  property: 'Annonce',
  user: 'Utilisateur',
  review: 'Avis',
  message: 'Message',
};

export function AdminReports() {
  const [status, setStatus] = useState<ReportStatus | ''>('pending');
  const { data: reports, isLoading } = useAdminReports(status);
  const updateReport = useUpdateReport();

  const act = (id: string, next: ReportStatus) => updateReport.mutate({ id, status: next });

  return (
    <div>
      <PageHeader title="Signalements" subtitle="Contenus et comptes signalés par les utilisateurs." />

      <div className="mb-5">
        <FilterTabs label="Statut des signalements" value={status} onChange={setStatus} options={STATUS_TABS} />
      </div>

      {updateReport.isError && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-600">L’action a échoué. Veuillez réessayer.</p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : reports && reports.length > 0 ? (
        <ul className="space-y-3">
          {reports.map((report) => {
            const badge = STATUS_BADGE[report.status];
            return (
              <li key={report.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{TARGET_LABELS[report.target_type]}</Badge>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <h3 className="mt-2 font-semibold text-primary-900">{report.reason}</h3>
                    {report.description && <p className="mt-1 text-sm text-gray-600">{report.description}</p>}
                    <p className="mt-2 text-xs text-gray-500">
                      {report.reporter
                        ? `Signalé par ${report.reporter.first_name} ${report.reporter.last_name} (${report.reporter.email})`
                        : 'Signalé'}
                      {' · '}{formatRelativeTime(report.created_at)}
                      {' · '}Réf. <span className="font-mono">{report.target_id.slice(0, 8)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.status === 'pending' && (
                      <Button size="sm" variant="outline" disabled={updateReport.isPending} onClick={() => act(report.id, 'reviewed')} icon={<Eye className="h-4 w-4" />}>
                        Prendre en charge
                      </Button>
                    )}
                    {report.status !== 'resolved' && (
                      <Button size="sm" disabled={updateReport.isPending} onClick={() => act(report.id, 'resolved')} icon={<CheckCircle2 className="h-4 w-4" />}>
                        Résolu
                      </Button>
                    )}
                    {report.status !== 'dismissed' && report.status !== 'resolved' && (
                      <Button size="sm" variant="ghost" disabled={updateReport.isPending} onClick={() => act(report.id, 'dismissed')} icon={<XCircle className="h-4 w-4" />}>
                        Rejeter
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Flag className="h-7 w-7" />}
          title="Aucun signalement"
          description={status === 'pending' ? 'Aucun nouveau signalement à traiter.' : 'Aucun signalement dans cette catégorie.'}
          className="rounded-2xl border border-dashed border-gray-200 bg-white"
        />
      )}
    </div>
  );
}
