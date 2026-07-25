import { supabase } from './supabase';

const BUCKET = 'property-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

class StorageService {
  async uploadPropertyImage(
    propertyId: string,
    file: File,
    isPrimary: boolean = false,
    altText?: string
  ) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Type de fichier non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Le fichier est trop volumineux. Maximum : 5 Mo.');
    }

    const ext = file.name.split('.').pop();
    const path = `properties/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { data: imageData, error: insertError } = await supabase
      .from('property_images')
      .insert({
        property_id: propertyId,
        url: urlData.publicUrl,
        storage_path: path,
        alt_text: altText || file.name,
        is_primary: isPrimary,
        sort_order: 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return imageData;
  }

  async deletePropertyImage(imageId: string, storagePath: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    const { error } = await supabase
      .from('property_images')
      .delete()
      .eq('id', imageId);
    if (error) throw error;
  }

  async reorderImages(images: { id: string; sort_order: number; is_primary: boolean }[]): Promise<void> {
    const updates = images.map((img) =>
      supabase
        .from('property_images')
        .update({ sort_order: img.sort_order, is_primary: img.is_primary })
        .eq('id', img.id)
    );
    await Promise.all(updates);
  }

  async getPropertyImages(propertyId: string) {
    const { data, error } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  }
}

export const storageService = new StorageService();
