// Client-side media helpers: real-format check, web optimisation (WebP, resize,
// thumbnails), video link recognition and safe CSV export.
import { sniffMediaType, type SniffedType } from '../../supabase/functions/_shared/media-validation';

export { sniffMediaType };

/** Reads the first bytes of a file to know its real type (extension is ignored). */
export async function detectFileType(file: Blob): Promise<SniffedType | null> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return sniffMediaType(head);
}

// ---------------------------------------------------------------- Video links
export type VideoLink =
  | { source: 'youtube'; id: string; embedUrl: string; thumbnail: string }
  | { source: 'vimeo'; id: string; embedUrl: string; thumbnail: null }
  | { source: 'external'; url: string };

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];
const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];

/**
 * Recognises only allow-listed providers. Anything else returns null:
 * arbitrary URLs are never placed in an iframe.
 */
export function parseVideoUrl(input: string): VideoLink | null {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.includes(host)) {
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { source: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
    return null;
  }

  if (VIMEO_HOSTS.includes(host)) {
    const match = url.pathname.match(/(?:^|\/)(?:video\/)?(\d{6,12})(?:\/|$)/);
    if (match) return { source: 'vimeo', id: match[1], embedUrl: `https://player.vimeo.com/video/${match[1]}`, thumbnail: null };
    return null;
  }

  if (/\.(mp4|webm)$/i.test(url.pathname) && !/["'<>\s]/.test(input)) return { source: 'external', url: url.toString() };
  return null;
}

/** Embed URL for a stored video row (null = play with <video>). */
export function videoEmbedUrl(video: { source?: string; provider_video_id?: string | null }): string | null {
  if (video.source === 'youtube' && video.provider_video_id && /^[A-Za-z0-9_-]{11}$/.test(video.provider_video_id)) {
    return `https://www.youtube-nocookie.com/embed/${video.provider_video_id}`;
  }
  if (video.source === 'vimeo' && video.provider_video_id && /^\d{6,12}$/.test(video.provider_video_id)) {
    return `https://player.vimeo.com/video/${video.provider_video_id}`;
  }
  return null;
}

export function isValidExternalImageUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'https:' && !/["'<>\s]/.test(input.trim()) && input.length <= 2000;
  } catch {
    return false;
  }
}

/** Resolves when the browser can actually display the image (unavailable links are refused). */
export function probeImage(src: string, timeoutMs = 8000): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('Image indisponible (délai dépassé).')), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Image indisponible ou bloquée par son hébergeur.')); };
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

// ---------------------------------------------------------------- Image optimisation
export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface CropArea {
  /** Position/size in source pixels. */
  x: number;
  y: number;
  size: number;
}

/** Target dimensions keeping the aspect ratio, never upscaling. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

async function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (blob && blob.type === 'image/webp') return blob;
  // Safari < 16 cannot encode WebP: JPEG fallback.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!jpeg) throw new Error('Impossible de traiter cette image.');
  return jpeg;
}

/**
 * Decodes and re-encodes the image (WebP), resized to `maxSize`. Re-encoding
 * also strips metadata (GPS position of the photo, camera…).
 */
export async function optimizeImage(file: Blob, maxSize: number, quality = 0.82, crop?: CropArea): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Ce fichier n’est pas une image lisible.');
  });
  const source = crop ?? { x: 0, y: 0, size: 0 };
  const sw = crop ? crop.size : bitmap.width;
  const sh = crop ? crop.size : bitmap.height;
  const target = fitWithin(sw, sh, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Traitement d’image indisponible sur cet appareil.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, source.x, source.y, sw, sh, 0, 0, target.width, target.height);
  bitmap.close();
  return { blob: await toBlob(canvas, quality), ...target };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------- CSV export
/** Escapes a CSV cell and neutralises spreadsheet formula injection (=, +, -, @). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][], separator = ';'): string {
  // BOM so Excel opens accents correctly.
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(separator)).join('\r\n');
}

export function downloadFile(content: string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
