import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Inbox, Mail, Phone, Search, ArrowLeft, ExternalLink, Archive, Trash2, CheckCheck, Send, StickyNote, History,
  MailOpen, MailWarning,
} from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks';
import { useInboxCounts, useInboxList, useInboxRealtime } from '@/hooks/useInbox';
import { inboxService, buildReplyMailto, type ContactMessage, type ContactSource, type ContactStatus, type InboxFilter } from '@/services/inbox.service';
import { newsletterAdminService } from '@/services/newsletter-admin.service';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/monetization';
import { cn, formatRelativeTime } from '@/lib/utils';

const STATUS_LABELS: Record<ContactStatus, string> = {
  pending: 'En attente', in_progress: 'En cours de traitement', replied: 'Répondu', resolved: 'Résolu', archived: 'Archivé',
};
const SOURCE_LABELS: Record<ContactSource, string> = {
  contact_page: 'Page contact', property: 'Annonce', agency: 'Page agence', service: 'Service', other: 'Autre',
};
const ACTION_LABELS: Record<string, string> = {
  read: 'Lu', marked_unread: 'Marqué non lu', status_changed: 'Statut modifié', assigned: 'Assigné',
  note_added: 'Note ajoutée', email_sent: 'E-mail envoyé depuis la plateforme',
};

function MessageDetail({ message, onBack }: { message: ContactMessage; onBack: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [note, setNote] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState(`Re: ${message.subject}`);
  const [replyBody, setReplyBody] = useState(`Bonjour ${message.full_name},\n\n`);
  const [confirm, setConfirm] = useState<'replied' | 'delete' | null>(null);

  const details = useQuery({ queryKey: ['admin', 'inbox', 'details', message.id], queryFn: () => inboxService.details(message.id) });
  const admins = useQuery({ queryKey: ['admin', 'admins'], queryFn: () => inboxService.admins(), staleTime: 5 * 60_000 });
  const provider = useQuery({ queryKey: ['admin', 'mail-provider'], queryFn: () => newsletterAdminService.providerStatus(), staleTime: 5 * 60_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'inbox'] });

  const update = useMutation({
    mutationFn: (changes: Parameters<typeof inboxService.update>[1]) => inboxService.update(message.id, changes),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const addNote = useMutation({
    mutationFn: () => inboxService.addNote(message.id, note),
    onSuccess: () => { setNote(''); refresh(); toast.success('Note ajoutée.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const sendReply = useMutation({
    mutationFn: () => inboxService.replyByEmail(message.id, replySubject, replyBody),
    onSuccess: () => { setReplyOpen(false); refresh(); toast.success('Réponse envoyée et message marqué comme répondu.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => inboxService.remove(message.id),
    onSuccess: () => { refresh(); toast.success('Message supprimé.'); onBack(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Opening a message marks it as read (journaled server-side).
  const { mutate } = update;
  useEffect(() => {
    if (!message.read_at) mutate({ read_at: new Date().toISOString() });
  }, [message.id, message.read_at, mutate]);

  const listingUrl = message.property ? `/annonces/${message.property.city?.slug ?? 'inconnu'}/${message.property.slug}` : null;

  return (
    <div className="space-y-5 p-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-brand-blue lg:hidden">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">{SOURCE_LABELS[message.source]} · {new Date(message.created_at).toLocaleString('fr-FR')}</p>
          <h2 className="mt-1 break-words text-xl font-bold text-primary-900">{message.subject}</h2>
        </div>
        <select aria-label="Statut" value={message.status} onChange={(e) => update.mutate({ status: e.target.value as ContactStatus })}
          className="select-chevron rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">
          {(Object.keys(STATUS_LABELS) as ContactStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 text-sm">
        <p className="font-semibold text-primary-900">{message.full_name}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a href={`mailto:${message.email}`} className="flex items-center gap-1 break-all text-brand-blue hover:underline"><Mail className="h-3.5 w-3.5" />{message.email}</a>
          {message.phone && <a href={`tel:${message.phone}`} className="flex items-center gap-1 text-brand-blue hover:underline"><Phone className="h-3.5 w-3.5" />{message.phone}</a>}
        </div>
        {listingUrl && (
          <Link to={listingUrl} target="_blank" className="mt-2 flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-brand-blue">
            <ExternalLink className="h-3.5 w-3.5" /> Annonce : {message.property?.title}
          </Link>
        )}
        {message.agency && <p className="mt-1 text-xs text-gray-600">Agence : {message.agency.name}</p>}
      </div>

      <p className="whitespace-pre-line break-words rounded-xl border border-gray-100 p-4 text-sm leading-relaxed text-gray-800">{message.message}</p>

      <div className="flex flex-wrap gap-2">
        <a href={buildReplyMailto(message)} className="inline-flex">
          <Button type="button" icon={<Mail className="h-4 w-4" />}>Répondre (messagerie)</Button>
        </a>
        {provider.data?.configured && (
          <Button type="button" variant="secondary" icon={<Send className="h-4 w-4" />} onClick={() => setReplyOpen((v) => !v)}>Répondre depuis la plateforme</Button>
        )}
        {message.status !== 'replied' && message.status !== 'resolved' && (
          <Button type="button" variant="outline" icon={<CheckCheck className="h-4 w-4" />} onClick={() => setConfirm('replied')}>J’ai répondu</Button>
        )}
        <Button type="button" variant="ghost" icon={message.read_at ? <MailWarning className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
          onClick={() => update.mutate({ read_at: message.read_at ? null : new Date().toISOString() })}>
          {message.read_at ? 'Marquer non lu' : 'Marquer lu'}
        </Button>
        {message.status !== 'archived' && (
          <Button type="button" variant="ghost" icon={<Archive className="h-4 w-4" />} onClick={() => update.mutate({ status: 'archived' }, { onSuccess: () => toast.success('Message archivé.') })}>Archiver</Button>
        )}
        {profile?.role === 'super_admin' && (
          <Button type="button" variant="ghost" icon={<Trash2 className="h-4 w-4 text-danger-600" />} onClick={() => setConfirm('delete')}>Supprimer</Button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        « Répondre (messagerie) » ouvre votre logiciel d’e-mail : rien n’est marqué comme envoyé automatiquement, confirmez avec « J’ai répondu ».
      </p>

      {replyOpen && (
        <form className="space-y-2 rounded-xl border border-brand-blue/20 bg-primary-50 p-4" onSubmit={(e) => { e.preventDefault(); sendReply.mutate(); }}>
          <input aria-label="Objet" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} maxLength={200}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <textarea aria-label="Réponse" rows={6} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} maxLength={10000}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReplyOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={sendReply.isPending} icon={<Send className="h-4 w-4" />}>Envoyer</Button>
          </div>
        </form>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-primary-900">Assigné à</span>
        <select value={message.assigned_to ?? ''} onChange={(e) => update.mutate({ assigned_to: e.target.value || null })}
          className="select-chevron w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-72">
          <option value="">Personne</option>
          {(admins.data || []).map((a) => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
        </select>
      </label>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900"><StickyNote className="h-4 w-4" />Notes internes</h3>
        <ul className="space-y-2">
          {(details.data?.notes || []).map((n) => (
            <li key={n.id} className="rounded-lg bg-secondary-50 p-3 text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-xs text-gray-500">{n.author ? `${n.author.first_name} ${n.author.last_name}` : 'Admin'} · {formatRelativeTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note (visible des administrateurs uniquement)" maxLength={4000}
            aria-label="Nouvelle note" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <Button type="submit" size="sm" variant="outline" isLoading={addNote.isPending} disabled={!note.trim()}>Ajouter</Button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900"><History className="h-4 w-4" />Historique</h3>
        <ol className="space-y-1.5 border-l-2 border-gray-100 pl-4 text-xs text-gray-600">
          {(details.data?.history || []).map((h) => (
            <li key={h.id}>
              <span className="font-semibold text-gray-800">{ACTION_LABELS[h.action] ?? h.action}</span>
              {h.to_status && <> : {STATUS_LABELS[h.to_status as ContactStatus] ?? h.to_status}</>}
              {' · '}{h.actor ? `${h.actor.first_name} ${h.actor.last_name}` : 'système'} · {formatRelativeTime(h.created_at)}
            </li>
          ))}
          <li>Reçu {formatRelativeTime(message.created_at)}</li>
        </ol>
      </section>

      <ConfirmDialog
        isOpen={confirm === 'replied'}
        title="Confirmer la réponse"
        description="Confirmez-vous avoir répondu à ce message (par e-mail, téléphone…) ? Le message passera au statut « Répondu »."
        confirmLabel="Oui, j’ai répondu"
        isLoading={update.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => update.mutate({ status: 'replied' }, { onSuccess: () => { setConfirm(null); toast.success('Message marqué comme répondu.'); } })}
      />
      <ConfirmDialog
        isOpen={confirm === 'delete'}
        title="Supprimer définitivement ?"
        description="Le message, ses notes et son historique seront supprimés. Préférez l’archivage pour conserver une trace."
        tone="danger"
        confirmLabel="Supprimer"
        isLoading={remove.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

export function AdminInbox() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<InboxFilter>('unread');
  const [source, setSource] = useState<ContactSource | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 350);
  const selectedId = params.get('id');

  const counts = useInboxCounts();
  const list = useInboxList(filter, debounced, page, source);
  const onNew = useCallback((subject: string) => toast.info(`Nouveau message : ${subject}`), [toast]);
  useInboxRealtime(true, onNew);

  // Deep links (notifications) may target a message outside the current page.
  const fromList = list.data?.data.find((m) => m.id === selectedId);
  const direct = useQuery({
    queryKey: ['admin', 'inbox', 'one', selectedId],
    queryFn: () => inboxService.get(selectedId!),
    enabled: !!selectedId && !fromList && !list.isLoading,
  });
  const selected = fromList ?? direct.data ?? null;

  const select = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('id', id); else n.delete('id'); return n; }, { replace: !id });

  const tabs = useMemo(() => {
    const c = counts.data;
    return [
      { value: 'unread' as const, label: 'Non lus', count: c?.unread },
      { value: 'all' as const, label: 'Tous', count: undefined },
      { value: 'read' as const, label: 'Lus', count: undefined },
      { value: 'pending' as const, label: 'En attente', count: c?.pending },
      { value: 'in_progress' as const, label: 'En cours', count: c?.in_progress },
      { value: 'replied' as const, label: 'Répondus', count: undefined },
      { value: 'archived' as const, label: 'Archivés', count: undefined },
    ];
  }, [counts.data]);

  return (
    <div>
      <PageHeader title="Messages et demandes de contact" subtitle={`${counts.data?.unread ?? '…'} message(s) non lu(s) · mise à jour en temps réel`} />
      <div className="mb-4 space-y-3">
        <FilterTabs label="Filtrer les messages" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={tabs} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher par nom, e-mail ou objet"
              aria-label="Rechercher" className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm" />
          </label>
          <select aria-label="Source" value={source} onChange={(e) => { setSource(e.target.value as ContactSource | ''); setPage(1); }}
            className="select-chevron rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">Toutes les sources</option>
            {(Object.keys(SOURCE_LABELS) as ContactSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel className={cn(selected && 'hidden lg:block')}>
          {list.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : !list.data || list.data.data.length === 0 ? (
            <EmptyState icon={<Inbox className="h-7 w-7" />} title="Aucun message" description="Les messages des formulaires du site apparaissent ici." />
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {list.data.data.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => select(m.id)}
                      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50', selectedId === m.id && 'bg-primary-50')}>
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', m.read_at ? 'bg-transparent' : 'bg-brand-blue')} aria-label={m.read_at ? undefined : 'Non lu'} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-sm', m.read_at ? 'text-gray-700' : 'font-bold text-primary-900')}>{m.full_name}</span>
                          <span className="shrink-0 text-[11px] text-gray-400">{formatRelativeTime(m.created_at)}</span>
                        </span>
                        <span className="block truncate text-sm text-gray-600">{m.subject}</span>
                        <span className="mt-1 flex gap-1.5 text-[11px]">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{SOURCE_LABELS[m.source]}</span>
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-primary-700">{STATUS_LABELS[m.status]}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {list.data.totalPages > 1 && <Pagination currentPage={page} totalPages={list.data.totalPages} onPageChange={setPage} className="p-3" />}
            </>
          )}
        </Panel>

        <Panel className={cn(!selected && 'hidden lg:block')}>
          {selected ? (
            <MessageDetail key={selected.id} message={selected} onBack={() => select(null)} />
          ) : (
            <EmptyState icon={<Mail className="h-7 w-7" />} title="Sélectionnez un message" description="Le détail, les notes et l’historique s’affichent ici." />
          )}
        </Panel>
      </div>
    </div>
  );
}
