import { supabase } from './supabase';
import type { Favorite } from '@/types';

class FavoritesService {
  async getAll(): Promise<Favorite[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        property_id,
        property:properties(
          *,
          city:cities!properties_city_id_fkey(id, name, slug),
          images:property_images!property_images_property_id_fkey(url, alt_text, is_primary, sort_order)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Favorite[];
  }

  async check(propertyId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async add(propertyId: string): Promise<void> {
    const { error } = await supabase
      .from('favorites')
      .insert({ property_id: propertyId });

    if (error) throw error;
  }

  async remove(propertyId: string): Promise<void> {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('property_id', propertyId);

    if (error) throw error;
  }

  async toggle(propertyId: string): Promise<boolean> {
    const isFavorited = await this.check(propertyId);
    if (isFavorited) {
      await this.remove(propertyId);
      return false;
    } else {
      await this.add(propertyId);
      return true;
    }
  }
}

export const favoritesService = new FavoritesService();
