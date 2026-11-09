import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useToast } from '@/components/ui/toast-context';
import { useAuth } from '@/contexts/AuthContext';
import { mediaService } from '@/services/media.service';
import { detectFileType, type CropArea } from '@/lib/media';
import { errorMessage } from '@/lib/monetization';

const FRAME = 240; // preview size (px)

/** Upload, crop (drag + zoom), replace or delete the profile photo. */
export function AvatarUploader() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // in source pixels, relative to the centred crop
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const pick = async (selected?: File) => {
    if (!selected) return;
    const type = await detectFileType(selected);
    if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      toast.error('Formats acceptés : JPG, JPEG, PNG ou WebP.');
      return;
    }
    const url = URL.createObjectURL(selected);
    const img = new Image();
    img.onload = () => {
      setFile(selected);
      setPreview({ url, width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error('Cette image ne peut pas être lue.'); };
    img.src = url;
  };

  // Square crop in source pixels.
  const crop = (): CropArea | undefined => {
    if (!preview) return undefined;
    const size = Math.min(preview.width, preview.height) / zoom;
    const maxX = (preview.width - size) / 2;
    const maxY = (preview.height - size) / 2;
    const cx = Math.max(-maxX, Math.min(maxX, offset.x));
    const cy = Math.max(-maxY, Math.min(maxY, offset.y));
    return { x: Math.round(preview.width / 2 - size / 2 + cx), y: Math.round(preview.height / 2 - size / 2 + cy), size: Math.round(size) };
  };

  const area = crop();
  const scale = area ? FRAME / area.size : 1;

  const save = async () => {
    if (!file) return;
    setProgress(0);
    try {
      await mediaService.uploadAvatar(file, crop(), setProgress);
      await refreshProfile();
      toast.success('Photo de profil mise à jour.');
      cancel();
    } catch (err) {
      toast.error(errorMessage(err, 'Impossible d’enregistrer la photo.'));
    } finally {
      setProgress(null);
    }
  };

  const cancel = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await mediaService.removeAvatar();
      await refreshProfile();
      toast.success('Photo supprimée.');
      setConfirmDelete(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      {preview && area ? (
        <div className="flex flex-col items-center gap-3">
          <div
            role="img"
            aria-label="Aperçu du recadrage — faites glisser pour ajuster"
            tabIndex={0}
            className="relative cursor-grab touch-none overflow-hidden rounded-full bg-gray-100 ring-4 ring-brand-yellow/60 active:cursor-grabbing"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOffset({ x: drag.current.ox - (e.clientX - drag.current.x) / scale, y: drag.current.oy - (e.clientY - drag.current.y) / scale });
            }}
            onPointerUp={() => { drag.current = null; }}
            onKeyDown={(e) => {
              const step = area.size / 20;
              if (e.key === 'ArrowLeft') setOffset((o) => ({ ...o, x: o.x - step }));
              if (e.key === 'ArrowRight') setOffset((o) => ({ ...o, x: o.x + step }));
              if (e.key === 'ArrowUp') setOffset((o) => ({ ...o, y: o.y - step }));
              if (e.key === 'ArrowDown') setOffset((o) => ({ ...o, y: o.y + step }));
            }}
          >
            <img
              src={preview.url}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: preview.width * scale, height: preview.height * scale, left: -area.x * scale, top: -area.y * scale }}
            />
          </div>
          <label className="flex w-full items-center gap-2 text-xs text-gray-500">
            Zoom
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#1D3E91]" />
          </label>
        </div>
      ) : (
        <UserAvatar firstName={profile?.first_name} lastName={profile?.last_name} url={profile?.avatar_url} size="lg" />
      )}

      <div className="flex-1 space-y-3">
        <div>
          <p className="font-semibold text-primary-900">Photo de profil</p>
          <p className="text-sm text-gray-500">JPG, PNG ou WebP. L’image est recadrée, compressée et ses métadonnées (position GPS…) sont supprimées.</p>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-input"
          onChange={(e) => pick(e.target.files?.[0])} />
        {preview ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={save} isLoading={progress !== null} icon={<Check className="h-4 w-4" />}>
              {progress !== null ? `Envoi… ${Math.round(progress * 100)} %` : 'Enregistrer la photo'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={progress !== null} icon={<X className="h-4 w-4" />}>Annuler</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} icon={<Camera className="h-4 w-4" />}>
              {profile?.avatar_url ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            {profile?.avatar_url && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4 text-danger-600" />}>
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Supprimer votre photo ?"
        description="Vos initiales seront affichées à la place."
        tone="danger"
        confirmLabel="Supprimer"
        isLoading={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}
