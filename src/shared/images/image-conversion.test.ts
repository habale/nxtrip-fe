import { canConvertImageToWebp, convertImageToWebp } from './image-conversion';

describe('WebP image conversion', () => {
  it('recognizes the raster formats supported by the converter', () => {
    expect(canConvertImageToWebp({ type: 'image/jpeg' })).toBe(true);
    expect(canConvertImageToWebp({ type: 'image/png' })).toBe(true);
    expect(canConvertImageToWebp({ type: 'image/webp' })).toBe(true);
    expect(canConvertImageToWebp({ type: 'image/gif' })).toBe(false);
    expect(canConvertImageToWebp({ type: 'image/svg+xml' })).toBe(false);
  });

  it('leaves non-convertible attachments unchanged', async () => {
    const file = new File(['document'], 'booking.pdf', {
      type: 'application/pdf',
    });

    await expect(convertImageToWebp(file)).resolves.toBe(file);
  });
});
