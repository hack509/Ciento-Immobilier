import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PageHero } from '@/components/ui/PageHero';
import { PropertyCard } from '@/components/ui/PropertyCard';
import { PlanCard } from '@/components/billing/BillingUI';
import type { Property } from '@/types';
import type { SubscriptionPlan } from '@/types/marketplace';

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const baseProperty = {
  id: 'p1', slug: 'villa-test', title: 'Villa test', price: 1000000, price_currency: 'HTG', listing_type: 'sale',
  property_type: 'villa', bedrooms: 3, bathrooms: 2, status: 'active', is_published: true, is_featured: false,
  price_negotiable: false, city: { name: 'Gonaïves', slug: 'gonaives' }, images: [],
} as unknown as Property;

describe('PageHero', () => {
  it('renders an accessible title, highlight and breadcrumb', () => {
    const html = render(<PageHero title="Trouvez votre" highlight="prochain bien" breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Annonces' }]} />);
    expect(html).toContain('<h1');
    expect(html).toContain('prochain bien');
    expect(html).toContain('aria-label="Fil d’Ariane"');
    expect(html).toContain('aria-current="page"');
  });
});

describe('PropertyCard badges', () => {
  it('shows Sponsorisé and Premium only while active', () => {
    const active = render(<PropertyCard property={{ ...baseProperty, sponsored_until: future, premium_until: future }} />);
    expect(active).toContain('Sponsorisé');
    expect(active).toContain('Premium');

    const expired = render(<PropertyCard property={{ ...baseProperty, sponsored_until: past, premium_until: past }} />);
    expect(expired).not.toContain('Sponsorisé');
    expect(expired).not.toContain('Premium');
  });

  it('links to the canonical listing URL', () => {
    expect(render(<PropertyCard property={baseProperty} />)).toContain('href="/annonces/gonaives/villa-test"');
  });
});

describe('PlanCard', () => {
  const plan: SubscriptionPlan = {
    id: 'plan', code: 'business', name: 'Business', tier: 'business', audience: 'all', description: null,
    price_monthly: 2500, price_yearly: 25000, currency: 'HTG', max_active_listings: null, featured_credits_per_period: 4,
    max_members: 5, trial_days: 14, features: ['Support prioritaire'], capabilities: {}, is_active: true, is_public: true,
    is_highlighted: true, sort_order: 1, created_at: '', updated_at: '',
  };

  it('renders database-driven price, limits and trial', () => {
    const html = render(<PlanCard plan={plan} cycle="yearly" action={<button>ok</button>} />);
    expect(html).toContain('25');
    expect(html).toContain('/ an');
    expect(html).toContain('annonces actives illimité(e)s');
    expect(html).toContain('14 jours d’essai gratuit');
    expect(html).toContain('Recommandé');
  });
});
