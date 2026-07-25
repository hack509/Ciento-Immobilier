import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storageService } from '@/services/storage.service';

export function useUploadPropertyImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, file, isPrimary, altText }: {
      propertyId: string;
      file: File;
      isPrimary?: boolean;
      altText?: string;
    }) => storageService.uploadPropertyImage(propertyId, file, isPrimary, altText),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useDeletePropertyImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, storagePath }: { imageId: string; storagePath: string }) =>
      storageService.deletePropertyImage(imageId, storagePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useReorderImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (images: { id: string; sort_order: number; is_primary: boolean }[]) =>
      storageService.reorderImages(images),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
