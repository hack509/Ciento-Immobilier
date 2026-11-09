import { supabase } from './supabase';
import { mediaService, signImageRows } from './media.service';
import type { PropertyImage } from '@/types';

const BUCKET = 'property-images';

/**
 * Kept for compatibility with existing callers. Uploads now go through the
 * media Edge Function (server-side format check, WebP optimisation, thumbnails).
 */
class StorageService {
  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }

  async uploadPropertyImage(propertyId: string, file: File, _isPrimary: boolean = false, _altText?: string) {
    return mediaService.uploadPropertyImage(propertyId, file);
  }

  async deletePropertyImage(imageId: string, _storagePath?: string | null): Promise<void> {
    await mediaService.deleteMedia('image', imageId);
  }

  async reorderImages(images: { id: string; sort_order: number; is_primary: boolean }[]): Promise<void> {
    await mediaService.saveImageOrder(images);
  }

  async getPropertyImages(propertyId: string) {
    const { data, error } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order');

    if (error) throw error;
    return signImageRows((data || []) as PropertyImage[]);
  }
}

export const storageService = new StorageService();
