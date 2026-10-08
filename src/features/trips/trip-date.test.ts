import { deriveTripStatus, getTripProgress } from './trip-date';

const datedTrip = {
  start_at: '2026-10-09T17:00:00.000Z',
  end_at: '2026-10-12T17:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
};

describe('derived trip status', () => {
  it('uses the trip timezone and keeps the full end date ongoing', () => {
    expect(
      deriveTripStatus(datedTrip, new Date('2026-10-09T16:59:00.000Z')),
    ).toBe('planning');
    expect(
      deriveTripStatus(datedTrip, new Date('2026-10-10T02:00:00.000Z')),
    ).toBe('ongoing');
    expect(
      deriveTripStatus(datedTrip, new Date('2026-10-13T10:00:00.000Z')),
    ).toBe('ongoing');
    expect(
      deriveTripStatus(datedTrip, new Date('2026-10-13T17:00:00.000Z')),
    ).toBe('completed');
  });

  it('handles trips with missing dates', () => {
    expect(
      deriveTripStatus(
        { start_at: null, end_at: null, timezone: 'UTC' },
        new Date('2026-10-10T00:00:00.000Z'),
      ),
    ).toBe('planning');
    expect(
      deriveTripStatus(
        { start_at: datedTrip.start_at, end_at: null, timezone: 'UTC' },
        new Date('2026-10-10T00:00:00.000Z'),
      ),
    ).toBe('ongoing');
    expect(
      deriveTripStatus(
        { start_at: null, end_at: datedTrip.end_at, timezone: 'UTC' },
        new Date('2026-10-14T00:00:00.000Z'),
      ),
    ).toBe('completed');
  });

  it('calculates inclusive trip progress in the trip timezone', () => {
    expect(
      getTripProgress(datedTrip, new Date('2026-10-10T02:00:00.000Z')),
    ).toEqual({ currentDay: 1, totalDays: 4 });
    expect(
      getTripProgress(datedTrip, new Date('2026-10-13T10:00:00.000Z')),
    ).toEqual({ currentDay: 4, totalDays: 4 });
  });
});
