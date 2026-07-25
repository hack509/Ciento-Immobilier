import { supabase } from './supabase';
import type { City, Neighborhood, Category, Agency, Agent, Profile } from '@/types';

class CitiesService {
  async getAll(): Promise<City[]> {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as City[];
  }

  async getBySlug(slug: string): Promise<City | null> {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data as City;
  }

  async getNeighborhoods(cityId: string): Promise<Neighborhood[]> {
    const { data, error } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('city_id', cityId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as Neighborhood[];
  }
}

class CategoriesService {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return (data || []) as Category[];
  }

  async getBySlug(slug: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data as Category;
  }
}

class AgenciesService {
  async getAll(limit?: number): Promise<Agency[]> {
    let query = supabase
      .from('agencies')
      .select('*, city:cities(name, slug)')
      .eq('is_active', true)
      .order('rating_avg', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Agency[];
  }

  async getBySlug(slug: string): Promise<Agency | null> {
    const { data, error } = await supabase
      .from('agencies')
      .select('*, city:cities(name, slug), owner:profiles(id, first_name, last_name, avatar_url, phone)')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data as Agency;
  }
}

class AgentsService {
  async getAll(limit?: number): Promise<Agent[]> {
    let query = supabase
      .from('agents')
      .select('*, profile:profiles(id, first_name, last_name, avatar_url, phone), agency:agencies(id, name, slug)')
      .eq('is_active', true)
      .order('rating_avg', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Agent[];
  }

  async getBySlug(slug: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*, profile:profiles(id, first_name, last_name, avatar_url, phone, bio), agency:agencies(id, name, slug, logo_url)')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data as Agent;
  }
}

class UsersService {
  async getAll(page: number = 1, perPage: number = 20) {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as Profile[], count: count || 0 };
  }

  async updateRole(userId: string, role: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async toggleActive(userId: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }
}

export const citiesService = new CitiesService();
export const categoriesService = new CategoriesService();
export const agenciesService = new AgenciesService();
export const agentsService = new AgentsService();
export const usersService = new UsersService();
