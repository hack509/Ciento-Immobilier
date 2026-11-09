import { supabase } from './supabase';
import { signImageRows } from './media.service';
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
          images:property_images!property_images_property_id_fkey(url, storage_path, thumbnail_path, source, alt_text, is_primary, sort_order)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const favorites = (data || []) as Favorite[];
    const signed = await signImageRows(favorites.flatMap((f) => f.property?.images || []));
    let index = 0;
    return favorites.map((favorite) => ({
      ...favorite,
      property: favorite.property
        ? { ...favorite.property, images: (favorite.property.images || []).map(() => signed[index++]) }
        : undefined,
    }));
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
    // user_id is required (NOT NULL + RLS check user_id = auth.uid()).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Connectez-vous pour ajouter des favoris.');
    const { error } = await supabase
      .from('favorites')
      .insert({ property_id: propertyId, user_id: user.id });

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
