import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Title block shared by dashboard and admin pages. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  navy: 'bg-primary-800 text-secondary-400',
  gold: 'bg-secondary-500 text-primary-900',
  light: 'bg-primary-50 text-primary-700',
  warning: 'bg-warning-100 text-warning-700',
} as const;

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  tone?: keyof typeof tones;
  to?: string;
  hint?: string;
}

/** KPI tile; renders as a link when `to` is set. */
export function StatCard({ icon: Icon, label, value, tone = 'light', to, hint }: StatCardProps) {
  const body = (
    <>
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 font-display text-3xl font-bold text-primary-900">
        {value === undefined ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-100" /> : value}
      </div>
      <div className="mt-1 text-sm font-medium text-gray-600">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </>
  );
  const className = 'block rounded-2xl border border-gray-100 bg-white p-5 shadow-card';

  return to ? (
    <Link to={to} className={cn(className, 'transition-all hover:-translate-y-0.5 hover:shadow-card-hover')}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** White content panel with an optional titled header. */
export function Panel({ title, action, children, className }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-gray-100 bg-white shadow-card', className)}>
      {title && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-primary-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Segmented filter used above lists (status, role…). */
export function FilterTabs<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (value: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto scrollbar-hide rounded-xl bg-primary-50 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
              selected ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-600 hover:text-primary-900'
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs', selected ? 'bg-secondary-500 text-primary-900' : 'bg-primary-100')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
