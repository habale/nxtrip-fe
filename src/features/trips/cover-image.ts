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
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, 1200 / image.width, 800 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas
      .getContext('2d')
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.82),
    );
    if (!blob) throw new Error('Unable to create a cover thumbnail.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
