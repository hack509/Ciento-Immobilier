import { supabase } from './supabase';
import { signImageRows } from './media.service';
import type { Property, PropertyStatus, SearchFilters, PaginatedResponse, Amenity } from '@/types';
import { ITEMS_PER_PAGE } from '@/lib/constants';
import { sanitizeSearchTerm } from '@/lib/monetization';

type PropertyWithStorageImages = {
  images?: { storage_path: string | null; url: string; source?: string; thumbnail_path?: string | null }[] | null;
};

class PropertiesService {
  /** Signs every image of every listing in one batched request (external images kept as-is). */
  private async signImages<T extends PropertyWithStorageImages>(properties: T[]): Promise<T[]> {
    const all = properties.flatMap((p) => p.images || []);
    const signed = await signImageRows(all);
    let index = 0;
    return properties.map((property) => ({
      ...property,
      images: (property.images || []).map(() => signed[index++]),
    }));
  }

  async getAll(filters: SearchFilters = {}): Promise<PaginatedResponse<Property>> {
    const page = filters.page || 1;
    const perPage = filters.per_page || ITEMS_PER_PAGE;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('properties')
      .select(`
        *,
        owner:public_profiles!properties_owner_id_fkey(id, first_name, last_name, avatar_url),
        agent:agents!properties_agent_id_fkey(id, profile:public_profiles!agents_profile_id_fkey(id, first_name, last_name, avatar_url)),
        agency:agencies!properties_agency_id_fkey(id, name, slug, logo_url),
        category:categories!properties_category_id_fkey(id, name, slug),
        city:cities!properties_city_id_fkey(id, name, slug),
        neighborhood:neighborhoods!properties_neighborhood_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `, { count: 'exact' })
      .eq('is_published', true)
      .eq('status', 'active');

    // Free text is sanitized: commas/parentheses would otherwise inject PostgREST filters.
    const term = filters.query ? sanitizeSearchTerm(filters.query) : '';
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    if (filters.city_id) query = query.eq('city_id', filters.city_id);
    if (filters.neighborhood_id) query = query.eq('neighborhood_id', filters.neighborhood_id);
    if (filters.property_type) query = query.eq('property_type', filters.property_type);
    if (filters.listing_type) query = query.eq('listing_type', filters.listing_type);
    if (filters.min_price) query = query.gte('price', filters.min_price);
    if (filters.max_price) query = query.lte('price', filters.max_price);
    if (filters.bedrooms) query = query.gte('bedrooms', filters.bedrooms);
    if (filters.bathrooms) query = query.gte('bathrooms', filters.bathrooms);
    // Surface: land uses the plot area, every other type the built area.
    const areaColumn = filters.property_type === 'land' ? 'land_area' : 'building_area';
    if (filters.min_area) query = query.gte(areaColumn, filters.min_area);
    if (filters.max_area) query = query.lte(areaColumn, filters.max_area);
    if (filters.availability === 'now') {
      const today = new Date().toISOString().slice(0, 10);
      query = query.or(`available_from.is.null,available_from.lte.${today}`);
    }

    // Paid visibility first (sponsored, then premium), then the requested order.
    query = query
      .order('sponsored_until', { ascending: false, nullsFirst: false })
      .order('premium_until', { ascending: false, nullsFirst: false });

    const allowedSorts = ['created_at', 'price', 'views_count'];
    const sortBy = allowedSorts.includes(filters.sort_by || '') ? filters.sort_by! : 'created_at';
    const sortOrder = filters.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: await this.signImages(data || []) as Property[],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    };
  }

  async getBySlug(slug: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        owner:public_profiles!properties_owner_id_fkey(id, first_name, last_name, avatar_url),
        agent:agents!properties_agent_id_fkey(id, profile:public_profiles!agents_profile_id_fkey(id, first_name, last_name, avatar_url), license_number, experience_years),
        agency:agencies!properties_agency_id_fkey(id, name, slug, logo_url, phone, email, whatsapp, is_verified),
        category:categories!properties_category_id_fkey(id, name, slug),
        city:cities!properties_city_id_fkey(id, name, slug),
        neighborhood:neighborhoods!properties_neighborhood_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order),
        amenities:property_amenities!property_amenities_property_id_fkey(amenity:amenities(id, name, slug, icon)),
        videos:property_videos!property_videos_property_id_fkey(id, url, source, provider_video_id, storage_path, thumbnail_url, title, sort_order)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) return null;
    const [property] = await this.signImages([data]);
    return property as Property;
  }

  async getById(id: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as Property;
  }

  async getFeatured(limit: number = 6): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        owner:public_profiles!properties_owner_id_fkey(id, first_name, last_name),
        city:cities!properties_city_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `)
      .eq('is_published', true)
      .eq('status', 'active')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return await this.signImages(data || []) as Property[];
  }

  /** Listings with a running sponsored promotion (home page section). */
  async getSponsored(limit: number = 6): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        city:cities!properties_city_id_fkey(id, name, slug),
        neighborhood:neighborhoods!properties_neighborhood_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `)
      .eq('is_published', true)
      .eq('status', 'active')
      .gt('sponsored_until', new Date().toISOString())
      .order('sponsored_until', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return await this.signImages(data || []) as Property[];
  }

  async getRecent(limit: number = 8): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        owner:public_profiles!properties_owner_id_fkey(id, first_name, last_name),
        city:cities!properties_city_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `)
      .eq('is_published', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return await this.signImages(data || []) as Property[];
  }

  async getByCity(cityId: string, limit: number = 8): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        city:cities!properties_city_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `)
      .eq('is_published', true)
      .eq('status', 'active')
      .eq('city_id', cityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return await this.signImages(data || []) as Property[];
  }

  async incrementViews(propertyId: string): Promise<void> {
    await supabase.rpc('increment_property_views', { property_id: propertyId });
  }

  async getOwnProperties(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Property>> {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
      .from('properties')
      .select(`
        *,
        city:cities!properties_city_id_fkey(id, name, slug),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `, { count: 'exact' })
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      data: await this.signImages(data || []) as Property[],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    };
  }

  /** Admin moderation queue: every listing (RLS grants admins full read), newest first. */
  async getForModeration(
    filters: { status?: PropertyStatus | ''; query?: string; page?: number; perPage?: number } = {}
  ): Promise<PaginatedResponse<Property>> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const from = (page - 1) * perPage;

    let query = supabase
      .from('properties')
      .select(`
        *,
        city:cities!properties_city_id_fkey(id, name, slug),
        owner:profiles!properties_owner_id_fkey(id, first_name, last_name, email, phone),
        images:property_images!property_images_property_id_fkey(id, url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.query) query = query.ilike('title', `%${filters.query}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: await this.signImages(data || []) as Property[],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    };
  }

  /** Admin decision on a listing; moderation fields are protected by a DB trigger for non-admins. */
  async moderate(id: string, decision: 'approve' | 'reject' | 'review'): Promise<void> {
    const changes = {
      approve: { status: 'active', is_published: true, published_at: new Date().toISOString() },
      reject: { status: 'suspended', is_published: false },
      review: { status: 'pending', is_published: false },
    }[decision];

    const { error } = await supabase.from('properties').update(changes).eq('id', id);
    if (error) throw error;
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<void> {
    const { error } = await supabase.from('properties').update({ is_featured: isFeatured }).eq('id', id);
    if (error) throw error;
  }

  async create(propertyData: Partial<Property>): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .single();

    if (error) throw error;
    return data as Property;
  }

  async update(id: string, propertyData: Partial<Property>): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .update(propertyData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Property;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getAmenities(): Promise<Amenity[]> {
    const { data, error } = await supabase
      .from('amenities')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (error) throw error;
    return (data || []) as Amenity[];
  }

  async setPropertyAmenities(propertyId: string, amenityIds: string[]): Promise<void> {
    await supabase
      .from('property_amenities')
      .delete()
      .eq('property_id', propertyId);

    if (amenityIds.length === 0) return;

    const { error } = await supabase
      .from('property_amenities')
      .insert(amenityIds.map((amenity_id) => ({ property_id: propertyId, amenity_id })));

    if (error) throw error;
  }
}

export const propertiesService = new PropertiesService();
