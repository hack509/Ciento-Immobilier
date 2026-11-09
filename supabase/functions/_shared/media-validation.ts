// Server-side media checks. Pure TypeScript (unit-tested with Vitest).
// The file extension and the declared Content-Type are never trusted: the
// first bytes of the stored object decide what the file really is.

export type MediaKind = 'avatar' | 'property_image' | 'property_video';
export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm';

export const ALLOWED_TYPES: Record<MediaKind, SniffedType[]> = {
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  property_image: ['image/jpeg', 'image/png', 'image/webp'],
  property_video: ['video/mp4', 'video/webm'],
};

export const EXTENSIONS: Record<SniffedType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/** Identifies the real format from magic bytes (needs at least the first 16 bytes). */
export function sniffMediaType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  // ISO-BMFF: ....ftyp<brand> (mp4, m4v, isom, avc1…) — excludes HEIC/AVIF image brands.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (!['heic', 'heix', 'mif1', 'msf1', 'avif', 'avis'].includes(brand)) return 'video/mp4';
    return null;
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}

export interface UploadLimits {
  maxImageMb: number;
  maxVideoMb: number;
  maxAvatarMb: number;
}

export function maxBytesFor(kind: MediaKind, limits: UploadLimits): number {
  const mb = kind === 'avatar' ? limits.maxAvatarMb : kind === 'property_video' ? limits.maxVideoMb : limits.maxImageMb;
  return Math.max(0, mb) * 1024 * 1024;
}

/** Pre-upload checks on what the client declares (re-checked on the real bytes at finalize). */
export function validateDeclaredUpload(kind: MediaKind, mime: string, size: number, limits: UploadLimits): string | null {
  if (!(kind in ALLOWED_TYPES)) return 'Type de média inconnu.';
  if (!ALLOWED_TYPES[kind].includes(mime as SniffedType)) {
    return kind === 'property_video' ? 'Formats vidéo acceptés : MP4 ou WebM.' : 'Formats acceptés : JPG, PNG ou WebP.';
  }
  if (!Number.isFinite(size) || size <= 0) return 'Fichier vide.';
  if (size > maxBytesFor(kind, limits)) {
    return `Fichier trop volumineux (maximum ${Math.round(maxBytesFor(kind, limits) / 1024 / 1024)} Mo).`;
  }
  return null;
}

/** Final verdict on the stored object. */
export function verifyStoredObject(kind: MediaKind, head: Uint8Array, size: number, limits: UploadLimits):
  { ok: true; type: SniffedType } | { ok: false; reason: string } {
  const type = sniffMediaType(head);
  if (!type || !ALLOWED_TYPES[kind].includes(type)) {
    return { ok: false, reason: 'Le contenu du fichier ne correspond pas à un format autorisé.' };
  }
  if (size <= 0 || size > maxBytesFor(kind, limits)) {
    return { ok: false, reason: 'Taille de fichier non autorisée.' };
  }
  return { ok: true, type };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Collision-free object names; the folder encodes ownership (checked by RLS). */
export function buildObjectPath(kind: MediaKind, ownerId: string, mime: SniffedType, randomId: string, suffix = ''): string {
  if (!UUID_RE.test(ownerId) || !UUID_RE.test(randomId)) throw new Error('invalid_id');
  const name = `${randomId}${suffix}.${EXTENSIONS[mime]}`;
  return kind === 'avatar' ? `${ownerId}/${name}` : `properties/${ownerId}/${name}`;
}

/** A finalize request may only reference an object the caller was allowed to create. */
export function isPathOwnedBy(kind: MediaKind, path: string, ownerId: string): boolean {
  const prefix = kind === 'avatar' ? `${ownerId}/` : `properties/${ownerId}/`;
  return path.startsWith(prefix) && /^[A-Za-z0-9/_.-]+$/.test(path) && !path.includes('..')
    && path.slice(prefix.length).split('/').length === 1;
}

export function bucketFor(kind: MediaKind): string {
  return kind === 'avatar' ? 'avatars' : kind === 'property_video' ? 'property-videos' : 'property-images';
}
