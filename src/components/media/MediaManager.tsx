import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Star, Trash2, ArrowLeft, ArrowRight, Link2, Film, AlertTriangle, Loader2, ImageOff, Flag, PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/toast-context';
import { mediaService, type MediaImage, type MediaVideo } from '@/services/media.service';
import { detectFileType, formatBytes, parseVideoUrl } from '@/lib/media';
import { errorMessage } from '@/lib/monetization';
import { cn } from '@/lib/utils';

interface QueueItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';

/** "Galerie de médias" of the listing form: uploads, links, ordering, main image, videos. */
export function MediaManager({ propertyId }: { propertyId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [toDelete, setToDelete] = useState<{ type: 'image' | 'video'; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const key = ['property-media', propertyId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => mediaService.getPropertyMedia(propertyId) });
  const images = data?.images ?? [];
  const videos = data?.videos ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  const update = (id: string, changes: Partial<QueueItem>) =>
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const items = files.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, progress: 0, status: 'waiting' as const }));
    setQueue((q) => [...q.filter((i) => i.status !== 'done'), ...items]);
    // Two uploads at a time keeps mobile connections responsive.
    let cursor = 0;
    let failures = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const i = cursor++;
        const file = files[i];
        const item = items[i];
        update(item.id, { status: 'uploading' });
        try {
          const type = await detectFileType(file);
          const onProgress = (p: number) => update(item.id, { progress: p });
          if (type?.startsWith('video/')) await mediaService.uploadPropertyVideo(propertyId, file, onProgress);
          else await mediaService.uploadPropertyImage(propertyId, file, onProgress);
          update(item.id, { status: 'done', progress: 1 });
          refresh();
        } catch (err) {
          failures++;
          update(item.id, { status: 'error', error: errorMessage(err, 'Échec du téléversement.') });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (failures === 0) toast.success(files.length > 1 ? `${files.length} fichiers ajoutés.` : 'Fichier ajouté.');
    else toast.error(`${failures} fichier(s) refusé(s) : voir le détail ci-dessus.`);
  };

  /** Optimistic reorder with rollback on server error. */
  const persistOrder = async (next: MediaImage[]) => {
    const previous = data;
    const normalized = next.map((img, i) => ({ ...img, sort_order: i }));
    queryClient.setQueryData(key, { images: normalized, videos });
    try {
      await mediaService.saveImageOrder(normalized.map((i) => ({ id: i.id, sort_order: i.sort_order, is_primary: i.is_primary })));
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    } catch (err) {
      queryClient.setQueryData(key, previous);
      toast.error(errorMessage(err, 'Ordre non enregistré.'));
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  const setPrimary = (id: string) => persistOrder(images.map((img) => ({ ...img, is_primary: img.id === id })));

  const addLink = async () => {
    const value = link.trim();
    if (!value) return;
    setLinkBusy(true);
    try {
      if (parseVideoUrl(value)) await mediaService.addVideoLink(propertyId, value);
      else await mediaService.addExternalImage(propertyId, value);
      setLink('');
      refresh();
      toast.success('Média ajouté.');
    } catch (err) {
      toast.error(errorMessage(err, 'Lien refusé.'));
    } finally {
      setLinkBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await mediaService.deleteMedia(toDelete.type, toDelete.id);
      refresh();
      toast.success('Média supprimé.');
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (dragIndex === null) handleFiles(Array.from(e.dataTransfer.files)); }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8',
          dragging ? 'border-brand-blue bg-primary-50' : 'border-gray-300 hover:border-brand-blue/60 hover:bg-gray-50',
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue"><Upload className="h-6 w-6" /></span>
        <p className="text-sm font-semibold text-primary-900">Glissez-déposez vos photos et vidéos, ou cliquez pour sélectionner</p>
        <p className="text-xs text-gray-500">Photos JPG, PNG, WebP (optimisées automatiquement) · Vidéos MP4, WebM · plusieurs fichiers à la fois</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only"
          onChange={(e) => { handleFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <ul className="space-y-2" aria-label="Téléversements">
          {queue.map((item) => (
            <li key={item.id} className="rounded-xl border border-gray-100 bg-white p-3 text-sm">
              <div className="flex items-center gap-2">
                {item.status === 'uploading' || item.status === 'waiting' ? <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
                  : item.status === 'error' ? <AlertTriangle className="h-4 w-4 text-danger-600" /> : <Star className="h-4 w-4 text-success-600" />}
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-gray-400">{formatBytes(item.size)}</span>
                {item.status !== 'uploading' && item.status !== 'waiting' && (
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setQueue((q) => q.filter((i) => i.id !== item.id))}>Masquer</button>
                )}
              </div>
              {item.status === 'error' ? (
                <p role="alert" className="mt-1 text-xs text-danger-600">{item.error}</p>
              ) : (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={cn('h-full rounded-full transition-all', item.status === 'done' ? 'bg-success-500' : 'bg-brand-blue')} style={{ width: `${Math.round(item.progress * 100)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Link */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Lien d’une image ou d’une vidéo</span>
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="https://… (image, YouTube, Vimeo ou fichier .mp4)" inputMode="url"
            className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20" />
        </label>
        <Button type="button" variant="outline" onClick={addLink} isLoading={linkBusy} disabled={!link.trim()}>Ajouter le lien</Button>
      </div>

      {/* Images */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary-900">Photos ({images.length})</h3>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : images.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucune photo. La première photo ajoutée devient l’image principale.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img, index) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }}
                onDragEnd={() => setDragIndex(null)}
                className={cn('group relative aspect-square overflow-hidden rounded-xl border-2 bg-gray-100',
                  img.is_primary ? 'border-brand-yellow' : 'border-transparent', dragIndex === index && 'opacity-50')}
              >
                <MediaThumb image={img} />
                <div className="absolute inset-x-0 top-0 flex justify-between p-1.5">
                  <div className="flex gap-1">
                    {img.source === 'external' && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">Lien</span>}
                    {img.moderation_status && img.moderation_status !== 'approved' && (
                      <span className="flex items-center gap-0.5 rounded bg-danger-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Flag className="h-3 w-3" />{img.moderation_status === 'removed' ? 'Retirée' : 'Signalée'}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => setToDelete({ type: 'image', id: img.id })} aria-label="Supprimer la photo"
                    className="rounded-lg bg-white/90 p-1.5 text-gray-600 hover:bg-danger-500 hover:text-white">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <button type="button" onClick={() => setPrimary(img.id)} aria-pressed={img.is_primary}
                    className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold',
                      img.is_primary ? 'bg-brand-yellow text-primary-900' : 'bg-white/90 text-gray-700 hover:bg-brand-yellow')}>
                    <Star className={cn('h-3 w-3', img.is_primary && 'fill-current')} />{img.is_primary ? 'Principale' : 'Définir'}
                  </button>
                  <span className="flex gap-1">
                    <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Déplacer avant"
                      className="rounded-lg bg-white/90 p-1 text-gray-700 disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label="Déplacer après"
                      className="rounded-lg bg-white/90 p-1 text-gray-700 disabled:opacity-40"><ArrowRight className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Videos */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-primary-900">Vidéos ({videos.length})</h3>
        {videos.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Ajoutez une visite vidéo : fichier MP4/WebM ou lien YouTube / Vimeo.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {videos.map((video) => <VideoRow key={video.id} video={video} onDelete={() => setToDelete({ type: 'video', id: video.id })} />)}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.type === 'video' ? 'Supprimer cette vidéo ?' : 'Supprimer cette photo ?'}
        description="Le fichier est supprimé définitivement."
        tone="danger"
        confirmLabel="Supprimer"
        isLoading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function MediaThumb({ image }: { image: MediaImage }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400"><ImageOff className="h-6 w-6" /><span className="text-[11px]">Image indisponible</span></div>;
  }
  return <img src={image.thumbnail_url || image.url} alt={image.alt_text || ''} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    onError={() => setFailed(true)} className="h-full w-full object-cover" draggable={false} />;
}

function VideoRow({ video, onDelete }: { video: MediaVideo; onDelete: () => void }) {
  const label = video.source === 'youtube' ? 'YouTube' : video.source === 'vimeo' ? 'Vimeo' : video.source === 'upload' ? 'Fichier' : 'Lien vidéo';
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-900 text-white">
        {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Film className="h-6 w-6" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-primary-900"><PlayCircle className="h-4 w-4 shrink-0 text-brand-blue" />{video.title || label}</p>
        <p className="text-xs text-gray-500">{label}{video.moderation_status === 'removed' ? ' · retirée par la modération' : ''}</p>
      </div>
      <button type="button" onClick={onDelete} aria-label="Supprimer la vidéo" className="rounded-lg p-2 text-gray-400 hover:bg-danger-50 hover:text-danger-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
