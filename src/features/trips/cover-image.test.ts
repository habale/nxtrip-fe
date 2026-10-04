import { COVER_IMAGE_MAX_BYTES, validateCoverImage } from './cover-image';

describe('cover image validation', () => {
  it('accepts supported images within the size limit', () => {
    expect(validateCoverImage({ type: 'image/jpeg', size: 1024 })).toBeNull();
  });

  it('rejects unsupported file types', () => {
    expect(validateCoverImage({ type: 'image/svg+xml', size: 1024 })).toBe(
      'type',
    );
  });

  it('rejects images larger than 10 MB', () => {
    expect(
      validateCoverImage({
        type: 'image/webp',
        size: COVER_IMAGE_MAX_BYTES + 1,
      }),
    ).toBe('size');
  });
});
