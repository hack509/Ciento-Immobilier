import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Records every PostgREST builder call so the search query can be asserted. */
const calls: [string, unknown[]][] = [];

function builder(result: unknown) {
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        return proxy;
      };
    },
  });
  return proxy;
}

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => builder({ data: [], error: null, count: 0 }),
    rpc: vi.fn(),
  },
}));
vi.mock('@/services/storage.service', () => ({ storageService: { getSignedUrl: async (p: string) => p } }));

const { propertiesService } = await import('@/services/properties.service');

describe('public search', () => {
  beforeEach(() => { calls.length = 0; });

  it('only returns validated, published listings', async () => {
    await propertiesService.getAll({});
    expect(calls).toContainEqual(['eq', ['is_published', true]]);
    expect(calls).toContainEqual(['eq', ['status', 'active']]);
  });

  it('ranks sponsored then premium listings before the requested order', async () => {
    await propertiesService.getAll({ sort_by: 'price', sort_order: 'asc' });
    const orders = calls.filter(([m]) => m === 'order').map(([, a]) => a[0]);
    expect(orders).toEqual(['sponsored_until', 'premium_until', 'price']);
  });

  it('ignores unknown sort columns', async () => {
    await propertiesService.getAll({ sort_by: 'owner_id' });
    const orders = calls.filter(([m]) => m === 'order').map(([, a]) => a[0]);
    expect(orders.at(-1)).toBe('created_at');
  });

  it('applies every advanced filter', async () => {
    await propertiesService.getAll({
      city_id: 'c1', neighborhood_id: 'n1', property_type: 'house', listing_type: 'rent',
      min_price: 100, max_price: 900, bedrooms: 3, bathrooms: 2, min_area: 120, availability: 'now',
    });
    expect(calls).toEqual(expect.arrayContaining([
      ['eq', ['city_id', 'c1']], ['eq', ['neighborhood_id', 'n1']], ['eq', ['property_type', 'house']],
      ['eq', ['listing_type', 'rent']], ['gte', ['price', 100]], ['lte', ['price', 900]],
      ['gte', ['bedrooms', 3]], ['gte', ['bathrooms', 2]], ['gte', ['building_area', 120]],
    ]));
    const availability = calls.find(([m, a]) => m === 'or' && String(a[0]).startsWith('available_from'));
    expect(availability).toBeDefined();
  });

  it('filters land by plot area', async () => {
    await propertiesService.getAll({ property_type: 'land', min_area: 500 });
    expect(calls).toContainEqual(['gte', ['land_area', 500]]);
  });

  it('cannot inject PostgREST filters through the search box', async () => {
    await propertiesService.getAll({ query: 'x%,status.eq.draft' });
    const or = calls.find(([m]) => m === 'or');
    expect(String(or?.[1][0])).not.toContain('status.eq.draft');
    expect(String(or?.[1][0]).split(',')).toHaveLength(2);
  });
});
