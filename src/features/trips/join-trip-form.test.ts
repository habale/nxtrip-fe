import { normalizeTripCode, validateTripCode } from './join-trip-form';

describe('join trip form', () => {
  it('normalizes pasted codes', () => {
    expect(normalizeTripCode('  abc123  ')).toBe('ABC123');
  });

  it('requires a usable code', () => {
    expect(validateTripCode('')).toBe('required');
    expect(validateTripCode('abc')).toBe('invalid');
    expect(validateTripCode('ABCD')).toBeUndefined();
  });
});
