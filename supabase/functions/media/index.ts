// Media Edge Function — the only way to put files in Storage.
//
// 1. prepare  : checks rights + limits, returns signed upload URLs (collision-free names)
// 2. (client uploads the bytes directly to Storage with the signed URL)
// 3. finalize : reads the stored bytes, checks the REAL format (magic bytes) and
//               size, then registers the media (or deletes the file if invalid)
// Other actions: remove_avatar, delete_media, cleanup_orphans (admin).
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  bucketFor, buildObjectPath, isPathOwnedBy, validateDeclaredUpload, verifyStoredObject,
  type MediaKind, type SniffedType, type UploadLimits,
} from '../_shared/media-validation.ts';
import { corsHeaders, json, parseOrigins, UUID_RE } from '../_shared/http.ts';

const env = Deno.env.toObject();
const origins = parseOrigins(env.ALLOWED_ORIGINS);
const KINDS: MediaKind[] = ['avatar', 'property_image', 'property_video'];

async function loadLimits(admin: SupabaseClient): Promise<UploadLimits> {
  const { data } = await admin.from('site_settings').select('key, value')
    .in('key', ['max_image_upload_mb', 'max_video_upload_mb', 'max_avatar_upload_mb']);
  const get = (key: string, fallback: number) => {
    const v = data?.find((s) => s.key === key)?.value;
    return typeof v === 'number' ? v : fallback;
  };
  return { maxImageMb: get('max_image_upload_mb', 5), maxVideoMb: get('max_video_upload_mb', 50), maxAvatarMb: get('max_avatar_upload_mb', 2) };
}

/** Uses the caller's JWT so the database decides (same rule as the RLS policies). */
async function canManageProperty(user: SupabaseClient, propertyId: string): Promise<boolean> {
  const { data, error } = await user.rpc('can_manage_property_object', { object_name: `properties/${propertyId}/check` });
  return !error && data === true;
}

/** Reads the first bytes and the size of a stored object. */
async function inspectObject(admin: SupabaseClient, bucket: string, path: string): Promise<{ head: Uint8Array; size: number } | null> {
  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return null;
  const response = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-63' } });
  if (!response.ok) return null;
  const head = new Uint8Array(await response.arrayBuffer()).slice(0, 64);
  const range = response.headers.get('content-range'); // bytes 0-63/123456
  const size = range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length') ?? head.length);
  return { head, size };
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request.headers.get('origin'), origins);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, cors);

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Service indisponible.' }, 503, cors);

  const authorization = request.headers.get('authorization') ?? '';
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: auth } = await user.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return json({ error: 'Authentification requise.' }, 401, cors);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Corps JSON invalide.' }, 400, cors); }
  const action = body.action;

  try {
    // ------------------------------------------------------------ prepare
    if (action === 'prepare') {
      const kind = body.kind as MediaKind;
      const mime = String(body.mime ?? '');
      const size = Number(body.size);
      const propertyId = String(body.property_id ?? '');
      if (!KINDS.includes(kind)) return json({ error: 'Type de média inconnu.' }, 400, cors);
      const limits = await loadLimits(admin);
      const invalid = validateDeclaredUpload(kind, mime, size, limits);
      if (invalid) return json({ error: invalid }, 422, cors);

      let owner = uid;
      if (kind !== 'avatar') {
        if (!UUID_RE.test(propertyId) || !(await canManageProperty(user, propertyId))) {
          return json({ error: 'Vous ne pouvez pas modifier cette annonce.' }, 403, cors);
        }
        const table = kind === 'property_image' ? 'property_images' : 'property_videos';
        const [{ count }, { data: max }] = await Promise.all([
          admin.from(table).select('id', { count: 'exact', head: true }).eq('property_id', propertyId),
          user.rpc('media_limit', { p_table: table }),
        ]);
        if ((count ?? 0) >= Number(max ?? 0)) return json({ error: `Nombre maximum de médias atteint (${max}).` }, 422, cors);
        owner = propertyId;
      }

      const id = crypto.randomUUID();
      const bucket = bucketFor(kind);
      const paths = [buildObjectPath(kind, owner, mime as SniffedType, id)];
      if (kind === 'property_image' && body.with_thumbnail) paths.push(buildObjectPath(kind, owner, mime as SniffedType, id, '_thumb'));
      const uploads = [];
      for (const path of paths) {
        const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
        if (error || !data) throw error ?? new Error('signed_upload_failed');
        uploads.push({ path, token: data.token });
      }
      return json({ bucket, uploads }, 200, cors);
    }

    // ------------------------------------------------------------ finalize
    if (action === 'finalize') {
      const kind = body.kind as MediaKind;
      const path = String(body.path ?? '');
      const thumbPath = body.thumbnail_path ? String(body.thumbnail_path) : null;
      const propertyId = String(body.property_id ?? '');
      if (!KINDS.includes(kind)) return json({ error: 'Type de média inconnu.' }, 400, cors);
      const owner = kind === 'avatar' ? uid : propertyId;
      const bucket = bucketFor(kind);
      const toRemove = [path, thumbPath].filter((p): p is string => !!p && isPathOwnedBy(kind, p, owner));
      if (!isPathOwnedBy(kind, path, owner) || (thumbPath && !isPathOwnedBy(kind, thumbPath, owner))) {
        return json({ error: 'Fichier non autorisé.' }, 403, cors);
      }
      if (kind !== 'avatar' && !(await canManageProperty(user, propertyId))) {
        return json({ error: 'Vous ne pouvez pas modifier cette annonce.' }, 403, cors);
      }

      const limits = await loadLimits(admin);
      const checks = await Promise.all(toRemove.map((p) => inspectObject(admin, bucket, p)));
      const verdicts = checks.map((c) => (c ? verifyStoredObject(kind, c.head, c.size, limits) : { ok: false as const, reason: 'Fichier introuvable.' }));
      const failed = verdicts.find((v) => !v.ok);
      if (failed && !failed.ok) {
        await admin.storage.from(bucket).remove(toRemove);
        return json({ error: failed.reason }, 422, cors);
      }
      const main = verdicts[0] as { ok: true; type: SniffedType };
      const size = checks[0]!.size;

      if (kind === 'avatar') {
        const publicUrl = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        const { error } = await admin.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid);
        if (error) throw error;
        // Replace: previous photos of this user are deleted.
        const { data: existing } = await admin.storage.from('avatars').list(uid, { limit: 100 });
        const old = (existing ?? []).map((o) => `${uid}/${o.name}`).filter((p) => p !== path);
        if (old.length) await admin.storage.from('avatars').remove(old);
        return json({ avatar_url: publicUrl }, 200, cors);
      }

      if (kind === 'property_image') {
        const { data: last } = await admin.from('property_images').select('sort_order').eq('property_id', propertyId)
          .order('sort_order', { ascending: false }).limit(1);
        const { count } = await admin.from('property_images').select('id', { count: 'exact', head: true }).eq('property_id', propertyId);
        const isPrimary = Boolean(body.is_primary) || (count ?? 0) === 0;
        if (isPrimary) await admin.from('property_images').update({ is_primary: false }).eq('property_id', propertyId);
        const { data, error } = await admin.from('property_images').insert({
          property_id: propertyId, url: path, storage_path: path, thumbnail_path: thumbPath, source: 'upload',
          mime_type: main.type, size_bytes: size, width: Number(body.width) || null, height: Number(body.height) || null,
          alt_text: typeof body.alt_text === 'string' ? body.alt_text.slice(0, 200) : null,
          is_primary: isPrimary, sort_order: (last?.[0]?.sort_order ?? -1) + 1, uploaded_by: uid,
        }).select('id').single();
        if (error) { await admin.storage.from(bucket).remove(toRemove); throw error; }
        return json({ id: data.id }, 200, cors);
      }

      const { data: last } = await admin.from('property_videos').select('sort_order').eq('property_id', propertyId)
        .order('sort_order', { ascending: false }).limit(1);
      const { data, error } = await admin.from('property_videos').insert({
        property_id: propertyId, url: path, storage_path: path, source: 'upload', mime_type: main.type, size_bytes: size,
        title: typeof body.title === 'string' ? body.title.slice(0, 120) : null,
        sort_order: (last?.[0]?.sort_order ?? -1) + 1, uploaded_by: uid,
      }).select('id').single();
      if (error) { await admin.storage.from(bucket).remove(toRemove); throw error; }
      return json({ id: data.id }, 200, cors);
    }

    // ------------------------------------------------------------ remove_avatar
    if (action === 'remove_avatar') {
      await admin.from('profiles').update({ avatar_url: null }).eq('id', uid);
      const { data: existing } = await admin.storage.from('avatars').list(uid, { limit: 100 });
      const paths = (existing ?? []).map((o) => `${uid}/${o.name}`);
      if (paths.length) await admin.storage.from('avatars').remove(paths);
      return json({ ok: true }, 200, cors);
    }

    // ------------------------------------------------------------ delete_media
    if (action === 'delete_media') {
      const type = body.media_type === 'video' ? 'video' : 'image';
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return json({ error: 'Média invalide.' }, 400, cors);
      const table = type === 'image' ? 'property_images' : 'property_videos';
      const { data: media } = await admin.from(table).select('*').eq('id', id).maybeSingle();
      if (!media) return json({ error: 'Média introuvable.' }, 404, cors);
      const { data: isAdmin } = await user.rpc('is_admin');
      if (!isAdmin && !(await canManageProperty(user, media.property_id))) return json({ error: 'Accès refusé.' }, 403, cors);
      const files = [media.storage_path, media.thumbnail_path].filter(Boolean) as string[];
      if (files.length) await admin.storage.from(type === 'image' ? 'property-images' : 'property-videos').remove(files);
      const { error } = await admin.from(table).delete().eq('id', id);
      if (error) throw error;
      if (type === 'image' && media.is_primary) {
        const { data: next } = await admin.from('property_images').select('id').eq('property_id', media.property_id)
          .order('sort_order').limit(1);
        if (next?.[0]) await admin.from('property_images').update({ is_primary: true }).eq('id', next[0].id);
      }
      return json({ ok: true }, 200, cors);
    }

    // ------------------------------------------------------------ cleanup_orphans (admin)
    if (action === 'cleanup_orphans') {
      const { data: isAdmin } = await user.rpc('is_admin');
      if (!isAdmin) return json({ error: 'Accès refusé.' }, 403, cors);
      const { data: orphans, error } = await admin.rpc('list_orphan_media_objects', { p_older_than: '24 hours' });
      if (error) throw error;
      const byBucket = new Map<string, string[]>();
      for (const o of (orphans ?? []) as { bucket_id: string; name: string }[]) {
        byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
      }
      let removed = 0;
      for (const [bucket, names] of byBucket) {
        for (let i = 0; i < names.length; i += 100) {
          const { data } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
          removed += data?.length ?? 0;
        }
      }
      return json({ removed }, 200, cors);
    }

    return json({ error: 'Action inconnue.' }, 400, cors);
  } catch (err) {
    console.error('media_error', action, err instanceof Error ? err.message : err);
    return json({ error: 'Le service de médias a rencontré une erreur.' }, 500, cors);
  }
});
