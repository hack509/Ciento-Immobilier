import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, Clock, UserX, Download, Search, Eye, Ban, RotateCcw, Archive, Trash2, Plus, Send, FlaskConical,
  Pencil, AlertTriangle, MailCheck,
} from 'lucide-react';
import { PageHeader, Panel, FilterTabs, StatCard } from '@/components/dashboard/DashboardUI';
import { DataTable, StatusBadge } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks';
import { newsletterAdminService, type Campaign, type Subscriber, type SubscriberFilters, type SubscriberStatus } from '@/services/newsletter-admin.service';
import { renderNewsletterHtml } from '../../../supabase/functions/_shared/newsletter-render';
import { downloadFile, toCsv } from '@/lib/media';
import { errorMessage } from '@/lib/monetization';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { getEnv } from '@/lib/env';

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  active: 'Actif', pending: 'En attente de confirmation', unsubscribed: 'Désabonné', suspended: 'Suspendu',
};
const EVENT_LABELS: Record<string, string> = {
  subscription_requested: 'Demande d’inscription', confirmed: 'Confirmation (double opt-in)', unsubscribed: 'Désabonnement',
  suspended: 'Suspension', reactivated: 'Réactivation', archived: 'Archivage', restored: 'Restauration',
};
const CAMPAIGN_LABELS: Record<Campaign['status'], string> = {
  draft: 'Brouillon', sending: 'Envoi en cours', sent: 'Envoyée', partially_sent: 'Envoyée partiellement', failed: 'Échec', cancelled: 'Annulée',
};
const statusTone = (s: string) => (s === 'unsubscribed' ? 'cancelled' : s === 'suspended' ? 'failed' : s);

// ------------------------------------------------------------------ Subscribers
function Subscribers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SubscriberFilters['status']>('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Subscriber | null>(null);
  const [action, setAction] = useState<{ type: 'suspend' | 'delete'; subscriber: Subscriber } | null>(null);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebounce(search, 350);
  const filters = { status, search: debounced, from: from || undefined, to: to || undefined };

  const stats = useQuery({ queryKey: ['admin', 'newsletter', 'stats'], queryFn: () => newsletterAdminService.stats() });
  const list = useQuery({
    queryKey: ['admin', 'newsletter', 'list', filters, page],
    queryFn: () => newsletterAdminService.list({ ...filters, page }),
    placeholderData: (p) => p,
  });
  const events = useQuery({
    queryKey: ['admin', 'newsletter', 'consent', detail?.id],
    queryFn: () => newsletterAdminService.consentEvents(detail!.id),
    enabled: !!detail,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'newsletter'] });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Parameters<typeof newsletterAdminService.update>[1] }) => newsletterAdminService.update(id, changes),
    onSuccess: () => { refresh(); toast.success('Abonné mis à jour.'); setAction(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => newsletterAdminService.remove(id),
    onSuccess: () => { refresh(); toast.success('Abonné supprimé définitivement.'); setAction(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await newsletterAdminService.listAll(filters);
      downloadFile(toCsv(
        ['E-mail', 'Statut', 'Source', 'Inscription', 'Consentement', 'Confirmation', 'Désabonnement', 'Archivé'],
        rows.map((r) => [r.email, STATUS_LABELS[r.status], r.source, r.created_at, r.consented_at, r.confirmed_at, r.unsubscribed_at, r.archived_at]),
      ), `newsletter-abonnes-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${rows.length} abonné(s) exporté(s).`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  const s = stats.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={UserCheck} tone="navy" label="Abonnés actifs" value={s?.active} hint={`+${s?.new_30_days ?? 0} sur 30 jours`} />
        <StatCard icon={Clock} tone="gold" label="En attente de confirmation" value={s?.pending} />
        <StatCard icon={UserX} label="Désabonnés" value={s?.unsubscribed} />
        <StatCard icon={Ban} tone="warning" label="Suspendus" value={s?.suspended} hint={`${s?.archived ?? 0} archivé(s)`} />
      </div>

      <div className="space-y-3">
        <FilterTabs label="Statut" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { value: '' as const, label: 'Tous' }, { value: 'active' as const, label: 'Actifs' }, { value: 'pending' as const, label: 'En attente' },
          { value: 'unsubscribed' as const, label: 'Désabonnés' }, { value: 'suspended' as const, label: 'Suspendus' }, { value: 'archived' as const, label: 'Archivés' },
        ]} />
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher une adresse e-mail"
              aria-label="Rechercher" className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm" />
          </label>
          <div className="flex gap-2">
            <input type="date" aria-label="Inscrits depuis le" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            <input type="date" aria-label="Inscrits jusqu’au" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <Button type="button" variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} isLoading={exporting}>Exporter CSV</Button>
        </div>
      </div>

      <Panel>
        <DataTable headers={['E-mail', 'Statut', 'Source', 'Inscription', 'Actions']}
          empty={list.data && list.data.data.length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucun abonné ne correspond.</p> : null}>
          {(list.data?.data || []).map((sub) => (
            <tr key={sub.id}>
              <td className="max-w-[16rem] truncate px-5 py-3 font-medium text-primary-900">{sub.email}</td>
              <td className="px-5 py-3"><StatusBadge status={statusTone(sub.status)} label={sub.archived_at ? 'Archivé' : STATUS_LABELS[sub.status]} /></td>
              <td className="px-5 py-3 text-xs text-gray-500">{sub.source}</td>
              <td className="whitespace-nowrap px-5 py-3 text-xs">{formatDate(sub.created_at)}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" aria-label="Détails" onClick={() => setDetail(sub)}><Eye className="h-4 w-4" /></Button>
                  {sub.status === 'suspended' ? (
                    <Button type="button" size="sm" variant="ghost" aria-label="Réactiver" onClick={() => update.mutate({ id: sub.id, changes: { status: 'active' } })}><RotateCcw className="h-4 w-4" /></Button>
                  ) : sub.status !== 'unsubscribed' && (
                    <Button type="button" size="sm" variant="ghost" aria-label="Suspendre" onClick={() => setAction({ type: 'suspend', subscriber: sub })}><Ban className="h-4 w-4" /></Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" aria-label={sub.archived_at ? 'Restaurer' : 'Archiver'}
                    onClick={() => update.mutate({ id: sub.id, changes: { archived_at: sub.archived_at ? null : new Date().toISOString() } })}>
                    {sub.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" aria-label="Supprimer" onClick={() => setAction({ type: 'delete', subscriber: sub })}><Trash2 className="h-4 w-4 text-danger-600" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {list.data && list.data.totalPages > 1 && <Pagination currentPage={page} totalPages={list.data.totalPages} onPageChange={setPage} className="p-3" />}
      </Panel>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Détails de l’abonné">
        {detail && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-gray-500">E-mail</dt><dd className="break-all font-semibold">{detail.email}</dd>
              <dt className="text-gray-500">Statut</dt><dd>{STATUS_LABELS[detail.status]}{detail.suspended_reason ? ` (${detail.suspended_reason})` : ''}</dd>
              <dt className="text-gray-500">Inscription</dt><dd>{new Date(detail.created_at).toLocaleString('fr-FR')}</dd>
              <dt className="text-gray-500">Confirmation</dt><dd>{detail.confirmed_at ? new Date(detail.confirmed_at).toLocaleString('fr-FR') : '—'}</dd>
              <dt className="text-gray-500">Source</dt><dd>{detail.source}</dd>
            </dl>
            <div>
              <p className="mb-2 font-semibold text-primary-900">Preuve de consentement</p>
              <ol className="space-y-1.5 border-l-2 border-gray-100 pl-4 text-xs text-gray-600">
                {(events.data || []).map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold text-gray-800">{EVENT_LABELS[e.event] ?? e.event}</span> · {new Date(e.created_at).toLocaleString('fr-FR')}
                    {e.source && <> · formulaire « {e.source} »</>}
                    {e.ip_hash && <span className="block font-mono text-[10px] text-gray-400">IP (empreinte SHA-256) {e.ip_hash.slice(0, 16)}…</span>}
                  </li>
                ))}
                {events.data?.length === 0 && <li>Inscription antérieure au suivi du consentement.</li>}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={action?.type === 'suspend'}
        title="Suspendre cet abonné ?"
        description="Il ne recevra plus aucune campagne et ne pourra pas se réinscrire lui-même."
        inputLabel="Motif"
        confirmLabel="Suspendre"
        tone="danger"
        isLoading={update.isPending}
        onClose={() => setAction(null)}
        onConfirm={(reason) => action && update.mutate({ id: action.subscriber.id, changes: { status: 'suspended', suspended_reason: reason } })}
      />
      <ConfirmDialog
        isOpen={action?.type === 'delete'}
        title="Supprimer définitivement ?"
        description="L’adresse et sa preuve de consentement seront effacées (droit à l’effacement). Préférez l’archivage pour conserver une trace."
        confirmLabel="Supprimer"
        tone="danger"
        isLoading={remove.isPending}
        onClose={() => setAction(null)}
        onConfirm={() => action && remove.mutate(action.subscriber.id)}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Campaigns
function Campaigns() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{ id?: string; subject: string; preheader: string; content: string } | null>(null);
  const [toSend, setToSend] = useState<Campaign | null>(null);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<{ id: string; sent: number; failed: number; remaining: number } | null>(null);

  const provider = useQuery({ queryKey: ['admin', 'mail-provider'], queryFn: () => newsletterAdminService.providerStatus(), staleTime: 5 * 60_000 });
  const stats = useQuery({ queryKey: ['admin', 'newsletter', 'stats'], queryFn: () => newsletterAdminService.stats() });
  const campaigns = useQuery({ queryKey: ['admin', 'newsletter', 'campaigns'], queryFn: () => newsletterAdminService.campaigns(),
    refetchInterval: (q) => ((q.state.data || []).some((c) => c.status === 'sending') ? 5000 : false) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'newsletter'] });

  const save = useMutation({
    mutationFn: () => newsletterAdminService.saveCampaign(draft!),
    onSuccess: () => { refresh(); setDraft(null); toast.success('Campagne enregistrée.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const test = useMutation({
    mutationFn: (id: string) => newsletterAdminService.sendTest(id),
    onSuccess: (to) => toast.success(`E-mail de test envoyé à ${to}.`),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const send = useMutation({
    mutationFn: (c: Campaign) => newsletterAdminService.send(c.id, (s) => setProgress({ id: c.id, ...s })),
    onSuccess: (s) => { refresh(); toast.success(`Campagne envoyée : ${s.sent} remis au fournisseur, ${s.failed} échec(s).`); },
    onError: (err) => { refresh(); toast.error(errorMessage(err)); },
    onSettled: () => { setToSend(null); setProgress(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => newsletterAdminService.deleteCampaign(id),
    onSuccess: () => { refresh(); setToDelete(null); toast.success('Brouillon supprimé.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const previewHtml = useMemo(() => draft ? renderNewsletterHtml({
    subject: draft.subject || '(sans objet)', preheader: draft.preheader, content: draft.content || '…',
    unsubscribeUrl: '#desinscription', siteUrl: getEnv().appUrl,
  }) : '', [draft]);
  const configured = provider.data?.configured;

  return (
    <div className="space-y-5">
      {provider.isSuccess && !configured && (
        <p className="flex items-start gap-2 rounded-2xl bg-warning-50 p-4 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          Aucun fournisseur d’e-mail n’est configuré (Resend ou Brevo). Vous pouvez préparer des campagnes ; l’envoi restera désactivé tant qu’un fournisseur n’est pas configuré.
        </p>
      )}
      {configured && (
        <p className="flex items-center gap-2 rounded-2xl bg-success-50 p-3 text-sm text-success-700"><MailCheck className="h-4 w-4" />Fournisseur actif : {provider.data?.provider}</p>
      )}

      <div className="flex justify-end">
        <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ subject: '', preheader: '', content: '# Titre\n\nVotre message…' })}>Nouvelle campagne</Button>
      </div>

      <Panel>
        <DataTable headers={['Campagne', 'Statut', 'Destinataires', 'Envoyés', 'Livrés', 'Ouverts', 'Clics', 'Échecs', 'Actions']}
          empty={campaigns.data?.length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune campagne.</p> : null}>
          {(campaigns.data || []).map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-3"><p className="max-w-[16rem] truncate font-medium text-primary-900">{c.subject}</p>
                <p className="text-xs text-gray-500">{c.completed_at ? `Envoyée ${formatRelativeTime(c.completed_at)}` : `Créée ${formatRelativeTime(c.created_at)}`}</p></td>
              <td className="px-5 py-3"><StatusBadge status={c.status === 'partially_sent' ? 'pending' : c.status === 'sent' ? 'succeeded' : c.status} label={CAMPAIGN_LABELS[c.status]} />
                {progress?.id === c.id && <span className="mt-1 block text-xs text-gray-500">{progress.sent} envoyés · {progress.remaining} restants</span>}</td>
              <td className="px-5 py-3 tabular-nums">{c.recipients_count}</td>
              <td className="px-5 py-3 tabular-nums">{c.sent_count}</td>
              <td className="px-5 py-3 tabular-nums">{c.delivered_count}</td>
              <td className="px-5 py-3 tabular-nums">{c.opened_count}</td>
              <td className="px-5 py-3 tabular-nums">{c.clicked_count}</td>
              <td className="px-5 py-3 tabular-nums">{c.failed_count + c.bounced_count}</td>
              <td className="px-5 py-3">
                <div className="flex gap-1">
                  {c.status === 'draft' && (
                    <>
                      <Button type="button" size="sm" variant="ghost" aria-label="Modifier" onClick={() => setDraft({ id: c.id, subject: c.subject, preheader: c.preheader ?? '', content: c.content })}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" aria-label="Envoyer un test" disabled={!configured} isLoading={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id)}><FlaskConical className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" disabled={!configured} icon={<Send className="h-4 w-4" />} onClick={() => setToSend(c)}>Envoyer</Button>
                      <Button type="button" size="sm" variant="ghost" aria-label="Supprimer" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-danger-600" /></Button>
                    </>
                  )}
                  {c.status === 'sending' && !send.isPending && (
                    <Button type="button" size="sm" variant="outline" disabled={!configured} onClick={() => send.mutate(c)}>Reprendre l’envoi</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="border-t border-gray-100 p-3 text-xs text-gray-500">
          « Envoyés » = acceptés par le fournisseur. Livraisons, ouvertures et clics proviennent des webhooks du fournisseur (s’ils sont configurés).
        </p>
      </Panel>

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Modifier la campagne' : 'Nouvelle campagne'} className="max-w-5xl">
        {draft && (
          <form className="grid gap-5 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-3">
              <label className="block text-sm"><span className="mb-1 block font-medium">Objet *</span>
                <input required minLength={3} maxLength={150} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">Texte d’aperçu (boîte de réception)</span>
                <input maxLength={200} value={draft.preheader} onChange={(e) => setDraft({ ...draft, preheader: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
              <label className="block text-sm"><span className="mb-1 block font-medium">Contenu *</span>
                <textarea required minLength={10} maxLength={50000} rows={14} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" /></label>
              <p className="text-xs text-gray-500">Mise en forme : <code># Titre</code>, <code>## Sous-titre</code>, <code>**gras**</code>, <code>*italique*</code>, <code>[texte](https://lien)</code>, <code>- liste</code>. Le lien de désabonnement est ajouté automatiquement.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
                <Button type="submit" isLoading={save.isPending}>Enregistrer le brouillon</Button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Prévisualisation</p>
              <iframe title="Prévisualisation de la newsletter" sandbox="" srcDoc={previewHtml} className="h-[520px] w-full rounded-xl border border-gray-200 bg-white" />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toSend}
        title="Envoyer la campagne ?"
        description={<>« {toSend?.subject} » sera envoyée à <strong>{stats.data?.active ?? '…'} abonné(s) actif(s)</strong>. Cette action est irréversible. Pensez à envoyer un test au préalable.</>}
        confirmLabel={progress ? `Envoi… ${progress.sent} envoyés` : 'Envoyer maintenant'}
        isLoading={send.isPending}
        onClose={() => { if (!send.isPending) setToSend(null); }}
        onConfirm={() => toSend && send.mutate(toSend)}
      />
      <ConfirmDialog isOpen={!!toDelete} title="Supprimer ce brouillon ?" tone="danger" confirmLabel="Supprimer" isLoading={remove.isPending}
        onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} />
    </div>
  );
}

export function AdminNewsletter() {
  const [tab, setTab] = useState<'subscribers' | 'campaigns'>('subscribers');
  return (
    <div>
      <PageHeader title="Gestion des newsletters" subtitle="Abonnés, preuve de consentement et campagnes." />
      <div className="mb-5">
        <FilterTabs label="Section" value={tab} onChange={setTab} options={[
          { value: 'subscribers', label: 'Abonnés' }, { value: 'campaigns', label: 'Campagnes' },
        ]} />
      </div>
      {tab === 'subscribers' ? <Subscribers /> : <Campaigns />}
    </div>
  );
}
