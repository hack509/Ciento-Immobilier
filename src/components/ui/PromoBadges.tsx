import { Crown, Megaphone, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const base = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm';

export function SponsoredBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, 'bg-brand-yellow text-primary-900', className)}>
      <Megaphone className="h-3 w-3" aria-hidden="true" />
      Sponsorisé
    </span>
  );
}

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, 'bg-gradient-to-r from-brand-blue to-primary-800 text-white ring-1 ring-brand-yellow/60', className)}>
      <Crown className="h-3 w-3 text-brand-yellow" aria-hidden="true" />
      Premium
    </span>
  );
}

export function VerifiedBadge({ label = 'Vérifiée', className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700', className)}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
