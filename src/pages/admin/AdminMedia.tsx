import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, Trash2, ExternalLink, Film, Sparkles, ImageOff } from 'lucide-react';
import { PageHeader, Panel, FilterTabs } from '@/components/dashboard/DashboardUI';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/toast-context';
import { supabase } from '@/services/supabase';
import { mediaService, signPaths } from '@/services/media.service';
import { errorMessage } from '@/lib/monetization';
import { formatRelativeTime } from '@/lib/utils';

interface MediaRow {
  id: string;
  media_type: 'image' | 'video';
  property_id: string;
  source: string;
  url: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  moderation_status: 'approved' | 'flagged' | 'removed';
  moderation_note: string | null;
  flag_count: number;
  created_at: string;
  preview?: string;
  property?: { title: string; slug: string; city: { slug: string } | null } | null;
  reasons?: string[];
}

const PAGE = 24;

async function loadMedia(filter: string, type: string, page: number) {
  let query = supabase.from('property_media').select('*', { count: 'exact' })
    .order('flag_count', { ascending: false }).order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (filter) query = query.eq('moderation_status', filter);
  if (type) query = query.eq('media_type', type);
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data || []) as MediaRow[];

  const [props, reports, signedImages] = await Promise.all([
    supabase.from('properties').select('id, title, slug, city:cities!properties_city_id_fkey(slug)').in('id', [...new Set(rows.map((r) => r.property_id))]),
    supabase.from('media_reports').select('media_id, reason').in('media_id', rows.filter((r) => r.flag_count > 0).map((r) => r.id)),
    signPaths('property-images', rows.filter((r) => r.media_type === 'image' && r.source === 'upload').map((r) => r.thumbnail_path || r.storage_path || '')),
  ]);
  const properties = (props.data || []) as unknown as { id: string; title: string; slug: string; city: { slug: string } | null }[];
  const reportRows = (reports.data || []) as { media_id: string; reason: string }[];
  const byId = new Map(properties.map((p) => [p.id, p]));
  return {
    count: count || 0,
    rows: rows.map((r): MediaRow => ({
      ...r,
      property: byId.get(r.property_id) ?? null,
      reasons: reportRows.filter((x) => x.media_id === r.id).map((x) => x.reason),
      preview: r.media_type === 'image'
        ? (r.source === 'upload' ? signedImages.get(r.thumbnail_path || r.storage_path || '') : r.url)
        : r.source === 'youtube' ? `https://i.ytimg.com/vi/${r.url.split('v=')[1]?.slice(0, 11)}/hqdefault.jpg` : undefined,
    })),
  };
}

export function AdminMedia() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('filtre') ?? 'flagged');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<MediaRow | null>(null);
  const [toRemove, setToRemove] = useState<MediaRow | null>(null);
  const [cleanup, setCleanup] = useState(false);

  const list = useQuery({ queryKey: ['admin', 'media', filter, type, page], queryFn: () => loadMedia(filter, type, page), placeholderData: (p) => p });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'media'] });

  const moderate = useMutation({
    mutationFn: async ({ row, status, note }: { row: MediaRow; status: 'approved' | 'removed'; note: string }) => {
      const { error } = await supabase.rpc('admin_moderate_media', { p_media_type: row.media_type, p_media_id: row.id, p_status: status, p_note: note });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { refresh(); setToRemove(null); toast.success(v.status === 'approved' ? 'Média approuvé.' : 'Média retiré de l’annonce publique.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (row: MediaRow) => mediaService.deleteMedia(row.media_type, row.id),
    onSuccess: () => { refresh(); setToDelete(null); toast.success('Média et fichier supprimés.'); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const orphans = useMutation({
    mutationFn: () => mediaService.cleanupOrphans(),
    onSuccess: (n) => { setCleanup(false); toast.success(`${n} fichier(s) orphelin(s) supprimé(s).`); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE));

  return (
    <div>
      <PageHeader title="Médias des annonces" subtitle="Modération des photos et vidéos, signalements et fichiers orphelins."
        actions={<Button type="button" variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={() => setCleanup(true)}>Nettoyer les fichiers orphelins</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <FilterTabs label="Modération" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[
          { value: 'flagged', label: 'Signalés' }, { value: 'removed', label: 'Retirés' }, { value: 'approved', label: 'Approuvés' }, { value: '', label: 'Tous' },
        ]} />
        <FilterTabs label="Type" value={type} onChange={(v) => { setType(v); setPage(1); }} options={[
          { value: '', label: 'Photos et vidéos' }, { value: 'image', label: 'Photos' }, { value: 'video', label: 'Vidéos' },
        ]} />
      </div>

      <Panel>
        {list.isLoading ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : !list.data || list.data.rows.length === 0 ? (
          <EmptyState title="Aucun média" description={filter === 'flagged' ? 'Aucun média signalé. 👍' : 'Rien à afficher pour ce filtre.'} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.rows.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="relative aspect-video bg-primary-50">
                  {m.preview ? <img src={m.preview} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-primary-300">{m.media_type === 'video' ? <Film className="h-8 w-8" /> : <ImageOff className="h-8 w-8" />}</div>}
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">{m.media_type === 'video' ? 'Vidéo' : 'Photo'} · {m.source}</span>
                  {m.flag_count > 0 && <span className="absolute right-2 top-2 rounded bg-danger-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">{m.flag_count} signalement(s)</span>}
                </div>
                <div className="space-y-2 p-3 text-sm">
                  {m.property && (
                    <Link to={`/annonces/${m.property.city?.slug ?? 'inconnu'}/${m.property.slug}`} target="_blank" className="flex items-center gap-1 font-medium text-primary-900 hover:text-brand-blue">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.property.title}</span>
                    </Link>
                  )}
                  <p className="text-xs text-gray-500">Ajouté {formatRelativeTime(m.created_at)} · {m.moderation_status === 'removed' ? 'Retiré' : m.moderation_status === 'flagged' ? 'Signalé' : 'Approuvé'}</p>
                  {m.reasons && m.reasons.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-danger-50 p-2 text-xs text-danger-600">{m.reasons.slice(0, 3).map((r, i) => <li key={i}>« {r} »</li>)}</ul>
                  )}
                  {m.moderation_note && <p className="text-xs text-gray-500">Note : {m.moderation_note}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.moderation_status !== 'approved' && (
                      <Button type="button" size="sm" variant="outline" icon={<Check className="h-4 w-4" />} isLoading={moderate.isPending}
                        onClick={() => moderate.mutate({ row: m, status: 'approved', note: 'Approuvé après vérification' })}>Approuver</Button>
                    )}
                    {m.moderation_status !== 'removed' && (
                      <Button type="button" size="sm" variant="ghost" icon={<EyeOff className="h-4 w-4" />} onClick={() => setToRemove(m)}>Retirer</Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4 text-danger-600" />} onClick={() => setToDelete(m)}>Supprimer</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="p-3" />}
      </Panel>

      <ConfirmDialog isOpen={!!toRemove} title="Retirer ce média ?" description="Il ne sera plus visible sur l’annonce publique ; le propriétaire le voit comme « retiré »."
        inputLabel="Motif (journalisé)" confirmLabel="Retirer" tone="danger" isLoading={moderate.isPending}
        onClose={() => setToRemove(null)} onConfirm={(note) => toRemove && moderate.mutate({ row: toRemove, status: 'removed', note })} />
      <ConfirmDialog isOpen={!!toDelete} title="Supprimer définitivement ?" description="Le fichier est effacé du stockage. Cette action est irréversible."
        confirmLabel="Supprimer" tone="danger" isLoading={remove.isPending} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete)} />
      <ConfirmDialog isOpen={cleanup} title="Nettoyer les fichiers orphelins ?" description="Supprime les fichiers de plus de 24 h qui ne sont rattachés à aucune annonce ni aucun profil (téléversements abandonnés, annonces supprimées)."
        confirmLabel="Nettoyer" isLoading={orphans.isPending} onClose={() => setCleanup(false)} onConfirm={() => orphans.mutate()} />
    </div>
  );
}
