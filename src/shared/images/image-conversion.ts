const CONVERTIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type WebpConversionOptions = {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
};

function webpFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${baseName || 'image'}.webp`;
}

export function canConvertImageToWebp(file: Pick<File, 'type'>) {
  return CONVERTIBLE_IMAGE_TYPES.has(file.type);
}

export async function convertImageToWebp(
  file: File,
  {
    quality = 0.82,
    maxWidth = 1920,
    maxHeight = 1920,
  }: WebpConversionOptions = {},
) {
  if (!canConvertImageToWebp(file)) return file;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create an image canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (!blob || blob.type !== 'image/webp') {
      throw new Error('This browser cannot convert images to WebP.');
    }

    return new File([blob], webpFileName(file.name), {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
