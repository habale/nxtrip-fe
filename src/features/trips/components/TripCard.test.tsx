import { formatTripDateRange, getTripDuration } from '../trip-date';

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

  it('calculates inclusive days and nights from local calendar dates', () => {
    expect(
      getTripDuration(
        '2026-10-14T17:00:00.000Z',
        '2026-10-17T17:00:00.000Z',
        'Asia/Bangkok',
      ),
    ).toEqual({ days: 4, nights: 3 });
  });

  it('requires both dates to calculate a duration', () => {
    expect(getTripDuration(null, '2026-10-18T00:00:00.000Z', 'UTC')).toBeNull();
  });
});
