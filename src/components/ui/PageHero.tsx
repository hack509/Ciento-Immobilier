import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { breadcrumbJsonLd } from '@/lib/seo-core';
import { getEnv } from '@/lib/env';

interface Crumb {
  label: string;
  to?: string;
}

interface HeroStat {
  value: ReactNode;
  label: string;
}

interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  /** Part of the title rendered in the brand yellow. */
  highlight?: ReactNode;
  subtitle?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  stats?: HeroStat[];
  /** Extra space at the bottom so a card (filters, form) can overlap the hero. */
  overlap?: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
  children?: ReactNode;
  className?: string;
}

const paddings = {
  sm: 'pt-8 pb-10 sm:pt-10 sm:pb-12',
  md: 'pt-10 pb-12 sm:pt-14 sm:pb-16',
  lg: 'pt-12 pb-14 sm:pt-20 sm:pb-24',
};

/**
 * Shared hero for public pages: brand blue → navy gradient, architectural grid,
 * yellow accent, breadcrumb, optional actions and key figures.
 */
export function PageHero({
  eyebrow, title, highlight, subtitle, icon: Icon, breadcrumbs, actions, stats, overlap = false,
  size = 'md', align = 'left', children, className,
}: PageHeroProps) {
  const centered = align === 'center';
  return (
    <section className={cn('relative isolate overflow-hidden bg-primary-900', className)}>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-blue via-primary-800 to-primary-900" />
      <div aria-hidden="true" className="hero-grid absolute inset-0" />
      <div aria-hidden="true" className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-yellow/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-brand-blue/40 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-yellow via-secondary-400 to-transparent" />

      <div className={cn(
        'relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
        paddings[size],
        overlap && 'pb-20 sm:pb-24',
        centered && 'text-center',
      )}>
        {breadcrumbs && breadcrumbs.length > 1 && (
          <Helmet>
            <script type="application/ld+json">
              {JSON.stringify(breadcrumbJsonLd(getEnv().appUrl, breadcrumbs.map((c) => ({ name: c.label, path: c.to ?? (typeof window !== 'undefined' ? window.location.pathname : undefined) }))))}
            </script>
          </Helmet>
        )}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Fil d’Ariane" className={cn('mb-5 flex flex-wrap items-center gap-1.5 text-xs text-primary-200', centered && 'justify-center')}>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-white transition-colors">{crumb.label}</Link>
                ) : (
                  <span aria-current="page" className="font-medium text-white">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className={cn('animate-fade-up', centered ? 'mx-auto max-w-3xl' : 'max-w-3xl')}>
          {(eyebrow || Icon) && (
            <p className={cn(
              'mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-yellow ring-1 ring-inset ring-white/15 backdrop-blur',
            )}>
              {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />}
              {eyebrow}
            </p>
          )}
          <h1 className="text-[clamp(1.875rem,6vw,2.5rem)] font-extrabold leading-[1.1] text-white sm:text-5xl">
            {title}
            {highlight && <> <span className="text-brand-yellow">{highlight}</span></>}
          </h1>
          {subtitle && (
            <p className={cn('mt-4 text-base leading-relaxed text-primary-100 sm:text-lg', centered ? 'mx-auto max-w-2xl' : 'max-w-2xl')}>
              {subtitle}
            </p>
          )}
          {actions && <div className={cn('mt-7 flex flex-col gap-3 sm:flex-row', centered && 'sm:justify-center')}>{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          <dl className={cn('mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4', centered && 'mx-auto')}>
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 backdrop-blur">
                <dt className="text-xs text-primary-200">{stat.label}</dt>
                <dd className="mt-0.5 font-display text-xl font-bold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}
      </div>
    </section>
  );
}
