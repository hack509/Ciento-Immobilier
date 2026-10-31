import { cn } from '@/lib/utils';

interface LogoProps {
  /** `light` for dark backgrounds (footer, hero overlays). */
  variant?: 'dark' | 'light';
  /** Hide the wordmark and show only the house mark. */
  markOnly?: boolean;
  className?: string;
}

/**
 * Ciento-Immobilier brand mark: gold roofline from the original logo,
 * redrawn as SVG so it stays crisp at header and favicon sizes.
 */
export function Logo({ variant = 'dark', markOnly = false, className }: LogoProps) {
  const ink = variant === 'dark' ? 'text-primary-800' : 'text-white';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
        <rect width="40" height="40" rx="10" className="fill-primary-800" />
        <path d="M8 21 L20 10 L32 21" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-secondary-500" />
        <path d="M12 19.5 V30 H28 V19.5" fill="none" strokeWidth="2.4" strokeLinejoin="round" className="stroke-white" />
        <rect x="17.5" y="22.5" width="5" height="7.5" rx="1" className="fill-secondary-500" />
      </svg>
      {!markOnly && (
        <span className="leading-none">
          <span className={cn('block font-display text-[17px] font-extrabold tracking-tight', ink)}>
            CIENTO
          </span>
          <span className={cn(
            'block text-[10px] font-semibold tracking-[0.28em] mt-0.5',
            variant === 'dark' ? 'text-secondary-700' : 'text-secondary-400'
          )}>
            IMMOBILIER
          </span>
        </span>
      )}
    </span>
  );
}
