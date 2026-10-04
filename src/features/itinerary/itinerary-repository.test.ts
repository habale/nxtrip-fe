import {
  MAX_ITINERARY_WINDOW_DAYS,
  validateItineraryDateWindow,
} from './itinerary-repository';

describe('itinerary date windows', () => {
  it('accepts a bounded day-based read', () => {
    expect(() =>
      validateItineraryDateWindow({
        tripId: 'trip-1',
        startDate: '2026-10-01',
        endDate: '2026-10-07',
      }),
    ).not.toThrow();
  });

  it('rejects invalid, reversed, and unbounded windows', () => {
    expect(() =>
      validateItineraryDateWindow({
        tripId: 'trip-1',
        startDate: '10/01/2026',
        endDate: '2026-10-07',
      }),
    ).toThrow(RangeError);
    expect(() =>
      validateItineraryDateWindow({
        tripId: 'trip-1',
        startDate: '2026-10-08',
        endDate: '2026-10-07',
      }),
    ).toThrow(RangeError);
    expect(() =>
      validateItineraryDateWindow({
        tripId: 'trip-1',
        startDate: '2026-01-01',
        endDate: '2026-03-01',
      }),
    ).toThrow(`cannot exceed ${MAX_ITINERARY_WINDOW_DAYS} days`);
  });
});
