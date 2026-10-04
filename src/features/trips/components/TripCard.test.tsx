import { formatTripDateRange } from '../trip-date';

describe('trip card date range', () => {
  it('displays a shared year once', () => {
    expect(
      formatTripDateRange(
        '2026-10-03T08:00:00.000Z',
        '2026-10-08T08:00:00.000Z',
        'en-US',
        'UTC',
      ),
    ).toBe('Oct 3 – Oct 8, 2026');
  });

  it('keeps both years when a trip crosses into a new year', () => {
    expect(
      formatTripDateRange(
        '2026-12-29T08:00:00.000Z',
        '2027-01-03T08:00:00.000Z',
        'en-US',
        'UTC',
      ),
    ).toBe('Dec 29, 2026 – Jan 3, 2027');
  });

  it('supports a single known boundary', () => {
    expect(
      formatTripDateRange(null, '2026-10-08T08:00:00.000Z', 'en-US', 'UTC'),
    ).toBe('Oct 8, 2026');
  });
});
