import { useEffect, useRef } from 'react';
import { useAds } from '@/hooks/useMarketplace';
import { catalogService } from '@/services/catalog.service';
import { cn } from '@/lib/utils';
import type { AdPlacement } from '@/types/marketplace';

/**
 * Professional advertising slot. Renders nothing when no campaign is live.
 * Impressions are counted once visible (IntersectionObserver), clicks on open.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const { data: ads } = useAds(placement);
  const ad = ads?.[0];
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!ad || !node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        catalogService.trackAd(ad.id, 'impression');
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ad]);

  if (!ad) return null;

  return (
    <aside aria-label="Publicité" className={cn('relative', className)}>
      <a
        ref={ref}
        href={ad.target_url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => catalogService.trackAd(ad.id, 'click')}
        className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-shadow hover:shadow-card-hover"
      >
        <img src={ad.image_url} alt={ad.alt_text || ad.title} loading="lazy" decoding="async" className="h-auto w-full object-cover" />
      </a>
      <span className="absolute right-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Publicité · {ad.advertiser_name}
      </span>
    </aside>
  );
}
