import { supabase } from './supabase';
import { getEnv } from '@/lib/env';
import { detectFileType, optimizeImage, parseVideoUrl, isValidExternalImageUrl, probeImage, type CropArea } from '@/lib/media';
import type { PropertyImage, PropertyVideo } from '@/types';

export type UploadProgress = (ratio: number) => void;
type Kind = 'avatar' | 'property_image' | 'property_video';

/** Hard ceiling before decoding in the browser (server limits apply after optimisation). */
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

export interface MediaImage extends PropertyImage {
  source?: 'upload' | 'external';
  external_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string;
  moderation_status?: 'approved' | 'flagged' | 'removed';
}

export interface MediaVideo extends PropertyVideo {
  source?: 'upload' | 'youtube' | 'vimeo' | 'external';
  provider_video_id?: string | null;
  moderation_status?: 'approved' | 'flagged' | 'removed';
}

async function callMedia<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('media', { body });
  if (error) {
    let message = 'Le service de médias est indisponible.';
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      const payload = await context.json().catch(() => null) as { error?: string } | null;
      if (payload?.error) message = payload.error;
    }
    throw new Error(message);
  }
  return data as T;
}

/** PUT to a signed upload URL with progress events (same format as storage-js). */
function uploadToSignedUrl(bucket: string, path: string, token: string, blob: Blob, onProgress?: UploadProgress): Promise<void> {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const url = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;
  const form = new FormData();
  form.append('cacheControl', '31536000');
  form.append('', blob);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Échec du téléversement.')));
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant le téléversement.'));
    xhr.send(form);
  });
}

async function prepare(kind: Kind, blob: Blob, extra: Record<string, unknown> = {}) {
  return callMedia<{ bucket: string; uploads: { path: string; token: string }[] }>({
    action: 'prepare', kind, mime: blob.type, size: blob.size, ...extra,
  });
}

class MediaService {
  // ---------------------------------------------------------------- Avatar
  async uploadAvatar(file: File, crop: CropArea | undefined, onProgress?: UploadProgress): Promise<string> {
    const type = await detectFileType(file);
    if (!type || !IMAGE_TYPES.includes(type)) throw new Error('Formats acceptés : JPG, PNG ou WebP.');
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Image trop volumineuse.');
    const processed = await optimizeImage(file, 400, 0.85, crop);
    const { bucket, uploads } = await prepare('avatar', processed.blob);
    await uploadToSignedUrl(bucket, uploads[0].path, uploads[0].token, processed.blob, onProgress);
    const result = await callMedia<{ avatar_url: string }>({ action: 'finalize', kind: 'avatar', path: uploads[0].path });
    return result.avatar_url;
  }

  async removeAvatar(): Promise<void> {
    await callMedia({ action: 'remove_avatar' });
  }

  // ---------------------------------------------------------------- Listing images
  async uploadPropertyImage(propertyId: string, file: File, onProgress?: UploadProgress): Promise<string> {
    const type = await detectFileType(file);
    if (!type || !IMAGE_TYPES.includes(type)) throw new Error(`« ${file.name} » : formats acceptés JPG, PNG ou WebP.`);
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`« ${file.name} » est trop volumineuse.`);
    const [main, thumb] = await Promise.all([optimizeImage(file, 1920, 0.82), optimizeImage(file, 480, 0.75)]);
    const { bucket, uploads } = await prepare('property_image', main.blob, { property_id: propertyId, with_thumbnail: true });
    const total = main.blob.size + thumb.blob.size;
    await uploadToSignedUrl(bucket, uploads[0].path, uploads[0].token, main.blob, (r) => onProgress?.((r * main.blob.size) / total));
    await uploadToSignedUrl(bucket, uploads[1].path, uploads[1].token, thumb.blob,
      (r) => onProgress?.((main.blob.size + r * thumb.blob.size) / total));
    const { id } = await callMedia<{ id: string }>({
      action: 'finalize', kind: 'property_image', property_id: propertyId, path: uploads[0].path,
      thumbnail_path: uploads[1].path, width: main.width, height: main.height,
      alt_text: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    return id;
  }

  async addExternalImage(propertyId: string, rawUrl: string): Promise<void> {
    const url = rawUrl.trim();
    if (!isValidExternalImageUrl(url)) throw new Error('Saisissez une adresse https valide.');
    await probeImage(url);
    const { error } = await supabase.from('property_images').insert({
      property_id: propertyId, url, source: 'external', external_url: url, sort_order: 999,
    });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Listing videos
  async uploadPropertyVideo(propertyId: string, file: File, onProgress?: UploadProgress): Promise<string> {
    const type = await detectFileType(file);
    if (!type || !VIDEO_TYPES.includes(type)) throw new Error('Formats vidéo acceptés : MP4 ou WebM.');
    const blob = file.type === type ? file : new Blob([file], { type });
    const { bucket, uploads } = await prepare('property_video', blob, { property_id: propertyId });
    await uploadToSignedUrl(bucket, uploads[0].path, uploads[0].token, blob, onProgress);
    const { id } = await callMedia<{ id: string }>({
      action: 'finalize', kind: 'property_video', property_id: propertyId, path: uploads[0].path,
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    });
    return id;
  }

  async addVideoLink(propertyId: string, rawUrl: string, title?: string): Promise<void> {
    const link = parseVideoUrl(rawUrl);
    if (!link) throw new Error('Lien non reconnu. Utilisez une vidéo YouTube, Vimeo ou un fichier .mp4/.webm en https.');
    const { error } = await supabase.from('property_videos').insert(link.source === 'external'
      ? { property_id: propertyId, url: link.url, source: 'external', title: title || null }
      : { property_id: propertyId, url: rawUrl.trim(), source: link.source, provider_video_id: link.id,
          thumbnail_url: link.thumbnail, title: title || null });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Read / organise
  async getPropertyMedia(propertyId: string): Promise<{ images: MediaImage[]; videos: MediaVideo[] }> {
    const [images, videos] = await Promise.all([
      supabase.from('property_images').select('*').eq('property_id', propertyId).order('sort_order'),
      supabase.from('property_videos').select('*').eq('property_id', propertyId).order('sort_order'),
    ]);
    if (images.error) throw images.error;
    if (videos.error) throw videos.error;
    return {
      images: await signImageRows((images.data || []) as MediaImage[]),
      videos: await signVideoRows((videos.data || []) as MediaVideo[]),
    };
  }

  async saveImageOrder(images: { id: string; sort_order: number; is_primary: boolean }[]): Promise<void> {
    const results = await Promise.all(images.map((img) =>
      supabase.from('property_images').update({ sort_order: img.sort_order, is_primary: img.is_primary }).eq('id', img.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteMedia(mediaType: 'image' | 'video', id: string): Promise<void> {
    await callMedia({ action: 'delete_media', media_type: mediaType, id });
  }

  async reportMedia(mediaType: 'image' | 'video', id: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('report_property_media', { p_media_type: mediaType, p_media_id: id, p_reason: reason });
    if (error) throw error;
  }

  async cleanupOrphans(): Promise<number> {
    const { removed } = await callMedia<{ removed: number }>({ action: 'cleanup_orphans' });
    return removed;
  }
}

/** One batched signing request per bucket (instead of one request per image). */
export async function signPaths(bucket: string, paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error) return map;
  for (const item of data || []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}

export async function signImageRows<T extends { storage_path?: string | null; thumbnail_path?: string | null; url: string; source?: string }>(rows: T[]):
  Promise<(T & { thumbnail_url?: string })[]> {
  const paths = rows.flatMap((r) => (r.source === 'external' ? [] : [r.storage_path, r.thumbnail_path])).filter((p): p is string => !!p);
  const signed = await signPaths('property-images', paths);
  return rows.map((r) => {
    if (r.source === 'external' || !r.storage_path) return { ...r, thumbnail_url: r.url };
    const url = signed.get(r.storage_path) ?? r.url;
    return { ...r, url, thumbnail_url: (r.thumbnail_path && signed.get(r.thumbnail_path)) || url };
  });
}

async function signVideoRows(rows: MediaVideo[]): Promise<MediaVideo[]> {
  const signed = await signPaths('property-videos', rows.filter((r) => r.source === 'upload' && r.storage_path).map((r) => r.storage_path!));
  return rows.map((r) => (r.source === 'upload' && r.storage_path ? { ...r, url: signed.get(r.storage_path) ?? r.url } : r));
}

export const mediaService = new MediaService();
