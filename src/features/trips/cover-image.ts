import { convertImageToWebp } from '../../shared/images/image-conversion';

export const COVER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const COVER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type CoverImageValidationError = 'type' | 'size';

export function validateCoverImage(
  file: Pick<File, 'size' | 'type'>,
): CoverImageValidationError | null {
  if (!COVER_IMAGE_TYPES.includes(file.type)) return 'type';
  if (file.size > COVER_IMAGE_MAX_BYTES) return 'size';
  return null;
}

export async function createCoverThumbnail(file: File) {
  return convertImageToWebp(file, {
    quality: 0.78,
    maxWidth: 1200,
    maxHeight: 800,
  });
}
