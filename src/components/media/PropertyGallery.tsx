import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X, Play, ImageOff, Flag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { mediaService } from '@/services/media.service';
import { videoEmbedUrl } from '@/lib/media';
import { errorMessage } from '@/lib/monetization';
import { cn } from '@/lib/utils';
import type { PropertyImage, PropertyVideo } from '@/types';

interface GalleryProps {
  images: PropertyImage[];
  videos?: PropertyVideo[];
  title: string;
  badges?: React.ReactNode;
}

function GalleryImage({ image, alt, className, eager }: { image: PropertyImage; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={cn('flex flex-col items-center justify-center gap-2 bg-primary-50 text-primary-300', className)}><ImageOff className="h-8 w-8" /><span className="text-xs">Image indisponible</span></div>;
  }
  return (
    <img src={image.url} alt={image.alt_text || alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
      fetchPriority={eager ? 'high' : 'auto'} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={className} />
  );
}

/** Click-to-load player: no third-party iframe/script until the visitor asks for it. */
function VideoPlayer({ video, title }: { video: PropertyVideo; title: string }) {
  const [active, setActive] = useState(false);
  const embed = videoEmbedUrl(video);
  if (!embed) {
    return (
      <video controls preload="none" playsInline className="aspect-video w-full rounded-xl bg-black" poster={video.thumbnail_url || undefined}>
        <source src={video.url} type={video.url.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4'} />
        Votre navigateur ne peut pas lire cette vidéo.
      </video>
    );
  }
  if (!active) {
    return (
      <button type="button" onClick={() => setActive(true)} aria-label={`Lire la vidéo ${video.title || title}`}
        className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-primary-900">
        {video.thumbnail_url && <img src={video.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-yellow text-primary-900 shadow-float transition-transform group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-2 left-3 text-xs font-semibold text-white">{video.source === 'vimeo' ? 'Vimeo' : 'YouTube'}</span>
      </button>
    );
  }
  return (
    <iframe
      src={`${embed}?autoplay=1`}
      title={video.title || `Vidéo — ${title}`}
      className="aspect-video w-full rounded-xl"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
    />
  );
}

export function PropertyGallery({ images, videos = [], title, badges }: GalleryProps) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const current = images[index];

  const go = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [fullscreen, go]);

  // Preload the next image for instant navigation.
  useEffect(() => {
    const next = images[(index + 1) % Math.max(count, 1)];
    if (next) { const img = new Image(); img.src = next.url; }
  }, [index, images, count]);

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touchStart.current = null;
    },
  };

  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const report = async (reason: string) => {
    if (!current) return;
    setReporting(true);
    try {
      await mediaService.reportMedia('image', current.id, reason);
      toast.success('Merci, notre équipe va examiner cette photo.');
      setReportOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {current ? (
          <div className="relative aspect-[16/10] bg-primary-50 sm:aspect-[16/9]" {...swipe}>
            <GalleryImage image={current} alt={title} eager={index === 0} className="h-full w-full object-cover" />
            {badges && <div className="absolute left-4 top-4 flex flex-wrap gap-2">{badges}</div>}
            <div className="absolute right-3 top-3 flex gap-2">
              {isAuthenticated && (
                <button type="button" onClick={() => setReportOpen(true)} aria-label="Signaler cette photo"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-gray-600 backdrop-blur hover:text-danger-600">
                  <Flag className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setFullscreen(true)} aria-label="Afficher en plein écran"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-primary-900 backdrop-blur hover:bg-white">
                <Expand className="h-4 w-4" />
              </button>
            </div>
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Photo précédente"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primary-900 shadow backdrop-blur hover:bg-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Photo suivante"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primary-900 shadow backdrop-blur hover:bg-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white" aria-live="polite">
                  {index + 1} / {count}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 bg-primary-50 text-primary-300">
            <ImageOff className="h-8 w-8" /><span className="text-sm">Photos à venir</span>
          </div>
        )}

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto p-2 scrollbar-hide" role="tablist" aria-label="Miniatures">
            {images.map((img, i) => (
              <button key={img.id} type="button" role="tab" aria-selected={i === index} aria-label={`Photo ${i + 1}`} onClick={() => setIndex(i)}
                className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition', i === index ? 'ring-brand-yellow' : 'ring-transparent opacity-70 hover:opacity-100')}>
                <img src={img.thumbnail_url || img.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {videos.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Visite vidéo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((v) => <VideoPlayer key={v.id} video={v} title={title} />)}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={reportOpen}
        title="Signaler cette photo"
        description="Photo trompeuse, inappropriée ou ne correspondant pas au bien ? Notre équipe l’examinera."
        inputLabel="Motif du signalement"
        confirmLabel="Envoyer le signalement"
        isLoading={reporting}
        onClose={() => setReportOpen(false)}
        onConfirm={report}
      />

      {fullscreen && current && (
        <div role="dialog" aria-modal="true" aria-label={`Photos — ${title}`} className="fixed inset-0 z-[90] flex flex-col bg-black/95" {...swipe}>
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm">{index + 1} / {count}</span>
            <button ref={closeRef} type="button" onClick={() => setFullscreen(false)} aria-label="Fermer"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"><X className="h-6 w-6" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-2">
            <GalleryImage image={current} alt={title} eager className="max-h-full max-w-full object-contain" />
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Photo précédente" className="absolute left-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Photo suivante" className="absolute right-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
