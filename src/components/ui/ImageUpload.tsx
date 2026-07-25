import { useState, useRef, useCallback } from 'react';
import { Upload, X, Star, GripVertical, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  images: { id: string; url: string; alt_text?: string; is_primary: boolean; sort_order: number }[];
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onReorder?: (images: { id: string; sort_order: number; is_primary: boolean }[]) => void;
  maxImages?: number;
  isLoading?: boolean;
  className?: string;
}

export function ImageUpload({
  images,
  onUpload,
  onRemove,
  onSetPrimary,
  maxImages = 20,
  isLoading = false,
  className,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) onUpload(files);
  }, [onUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canUpload = images.length < maxImages;

  return (
    <div className={cn('space-y-4', className)}>
      {canUpload && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-secondary-500 bg-secondary-50'
              : 'border-gray-300 hover:border-secondary-400 hover:bg-gray-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Upload className={cn('w-6 h-6', isDragging ? 'text-secondary-500' : 'text-gray-400')} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? 'Déposez les images ici' : 'Glissez-déposez vos images ici'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ou cliquez pour sélectionner ({images.length}/{maxImages})
              </p>
            </div>
            <p className="text-xs text-gray-400">JPEG, PNG, WebP, GIF — Max 5 Mo</p>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'relative group rounded-xl overflow-hidden border-2 aspect-square',
                image.is_primary ? 'border-secondary-500' : 'border-gray-200'
              )}
            >
              {isLoading ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-secondary-300 border-t-secondary-500 rounded-full animate-spin" />
                </div>
              ) : (
                <img src={image.url} alt={image.alt_text || ''} className="w-full h-full object-cover" />
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
                <div className="absolute top-2 left-2 right-2 flex items-start justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSetPrimary(image.id); }}
                    className={cn(
                      'p-1.5 rounded-lg text-xs transition-colors',
                      image.is_primary
                        ? 'bg-secondary-500 text-white'
                        : 'bg-white/90 text-gray-600 hover:bg-secondary-500 hover:text-white'
                    )}
                    title="Image principale"
                  >
                    <Star className={cn('w-3.5 h-3.5', image.is_primary && 'fill-current')} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(image.id); }}
                    className="p-1.5 rounded-lg bg-white/90 text-gray-600 hover:bg-danger-500 hover:text-white transition-colors"
                    title="Supprimer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {image.is_primary && (
                  <div className="absolute bottom-2 left-2">
                    <span className="px-2 py-0.5 bg-secondary-500 text-white text-xs font-medium rounded-full">
                      Principale
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !canUpload && (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Aucune image</p>
        </div>
      )}
    </div>
  );
}
