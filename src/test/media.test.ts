import { describe, expect, it } from 'vitest';
import {
  bucketFor, buildObjectPath, isPathOwnedBy, sniffMediaType, validateDeclaredUpload, verifyStoredObject,
} from '../../supabase/functions/_shared/media-validation';
import { csvCell, fitWithin, isValidExternalImageUrl, parseVideoUrl, toCsv, videoEmbedUrl } from '@/lib/media';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(32).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const LIMITS = { maxImageMb: 5, maxVideoMb: 50, maxAvatarMb: 2 };
const UID = '00000000-0000-4000-8000-0000000000a1';
const RID = '11111111-2222-4333-8444-555555555555';

describe('real file type detection (magic bytes, extension ignored)', () => {
  it('recognises allowed formats', () => {
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMediaType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe('image/webp');
    expect(sniffMediaType(bytes(0, 0, 0, 0x20, ...ascii('ftypisom')))).toBe('video/mp4');
    expect(sniffMediaType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
  });

  it('rejects disguised or unsupported files', () => {
    expect(sniffMediaType(bytes(...ascii('<svg xmlns=')))).toBeNull();            // SVG can carry scripts
    expect(sniffMediaType(bytes(...ascii('<!DOCTYPE html>')))).toBeNull();
    expect(sniffMediaType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();              // Windows .exe
    expect(sniffMediaType(bytes(...ascii('GIF89a')))).toBeNull();                  // GIF not allowed
    expect(sniffMediaType(bytes(0, 0, 0, 0x18, ...ascii('ftypheic')))).toBeNull(); // HEIC photo, not a video
    expect(sniffMediaType(new Uint8Array([0xff, 0xd8]))).toBeNull();               // truncated
  });

  it('checks declared type and size before upload', () => {
    expect(validateDeclaredUpload('avatar', 'image/webp', 100_000, LIMITS)).toBeNull();
    expect(validateDeclaredUpload('avatar', 'image/gif', 100_000, LIMITS)).toMatch(/JPG, PNG ou WebP/);
    expect(validateDeclaredUpload('avatar', 'image/png', 3 * 1024 * 1024, LIMITS)).toMatch(/trop volumineux/);
    expect(validateDeclaredUpload('property_video', 'video/mp4', 40 * 1024 * 1024, LIMITS)).toBeNull();
    expect(validateDeclaredUpload('property_video', 'image/png', 10, LIMITS)).toMatch(/MP4 ou WebM/);
    expect(validateDeclaredUpload('property_image', 'image/jpeg', 0, LIMITS)).toMatch(/vide/);
  });

  it('re-verifies the stored bytes (a renamed file is refused)', () => {
    const html = bytes(...ascii('<html><script>'));
    expect(verifyStoredObject('property_image', html, 100, LIMITS)).toEqual({ ok: false, reason: expect.any(String) });
    expect(verifyStoredObject('property_video', bytes(0xff, 0xd8, 0xff), 100, LIMITS).ok).toBe(false); // image sent as video
    expect(verifyStoredObject('property_image', bytes(0xff, 0xd8, 0xff), 6 * 1024 * 1024, LIMITS).ok).toBe(false);
    expect(verifyStoredObject('property_image', bytes(0xff, 0xd8, 0xff), 1000, LIMITS)).toEqual({ ok: true, type: 'image/jpeg' });
  });

  it('names files without collisions inside the owner folder', () => {
    expect(buildObjectPath('avatar', UID, 'image/webp', RID)).toBe(`${UID}/${RID}.webp`);
    expect(buildObjectPath('property_image', UID, 'image/webp', RID, '_thumb')).toBe(`properties/${UID}/${RID}_thumb.webp`);
    expect(() => buildObjectPath('avatar', '../etc', 'image/webp', RID)).toThrow();
    expect(bucketFor('property_video')).toBe('property-videos');
  });

  it('refuses paths outside the caller folder (traversal, other users)', () => {
    expect(isPathOwnedBy('avatar', `${UID}/${RID}.webp`, UID)).toBe(true);
    expect(isPathOwnedBy('avatar', `${RID}/${RID}.webp`, UID)).toBe(false);
    expect(isPathOwnedBy('avatar', `${UID}/../x/${RID}.webp`, UID)).toBe(false);
    expect(isPathOwnedBy('avatar', `${UID}/sub/${RID}.webp`, UID)).toBe(false);
    expect(isPathOwnedBy('property_image', `properties/${UID}/${RID}.webp`, UID)).toBe(true);
    expect(isPathOwnedBy('property_image', `properties/${RID}/${RID}.webp`, UID)).toBe(false);
  });
});

describe('video links: allow-listed providers only', () => {
  it('parses YouTube and Vimeo URLs into privacy-friendly embeds', () => {
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
      expect(parseVideoUrl(url)).toMatchObject({ source: 'youtube', id: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    }
    expect(parseVideoUrl('https://vimeo.com/76979871')).toMatchObject({ source: 'vimeo', id: '76979871' });
    expect(parseVideoUrl('https://cdn.example.com/visite.mp4')).toMatchObject({ source: 'external' });
  });

  it('never accepts arbitrary iframes or unsafe links', () => {
    expect(parseVideoUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();       // not https
    expect(parseVideoUrl('https://evil.example/embed/dQw4w9WgXcQ')).toBeNull();
    expect(parseVideoUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull();
    expect(parseVideoUrl('https://www.youtube.com/watch?v=bad"><script>')).toBeNull();
    expect(parseVideoUrl('https://example.com/page.html')).toBeNull();
    expect(videoEmbedUrl({ source: 'youtube', provider_video_id: '"><svg onload=1>' })).toBeNull();
    expect(videoEmbedUrl({ source: 'vimeo', provider_video_id: '76979871' })).toBe('https://player.vimeo.com/video/76979871');
  });

  it('validates external image URLs', () => {
    expect(isValidExternalImageUrl('https://images.example.com/a.jpg')).toBe(true);
    expect(isValidExternalImageUrl('http://images.example.com/a.jpg')).toBe(false);
    expect(isValidExternalImageUrl('https://x.test/a.jpg" onerror="alert(1)')).toBe(false);
    expect(isValidExternalImageUrl('data:image/png;base64,AAAA')).toBe(false);
  });
});

describe('image optimisation & CSV export', () => {
  it('resizes keeping the ratio and never upscales', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 3000, 480)).toEqual({ width: 160, height: 480 });
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+33 6')).toBe("'+33 6");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell(null)).toBe('');
  });

  it('produces an Excel-friendly CSV', () => {
    const csv = toCsv(['E-mail', 'Statut'], [['a@b.ht', 'Actif']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿E-mail;Statut\r\na@b.ht;Actif');
  });
});
