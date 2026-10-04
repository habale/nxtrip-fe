import type { Trip } from '../trips/trip-repository';
import { getInitialItineraryWindow, itineraryDays } from './itinerary-window';

const trip = {
  id: 'trip-1',
  start_at: '2026-10-01T00:00:00Z',
  end_at: '2026-10-20T00:00:00Z',
  timezone: 'UTC',
} as Trip;

describe('itinerary view window', () => {
  it('centers an ongoing trip around today without loading the full trip', () => {
    expect(
      getInitialItineraryWindow(trip, new Date('2026-10-10T12:00:00Z')),
    ).toEqual({
      tripId: 'trip-1',
      startDate: '2026-10-07',
      endDate: '2026-10-13',
      selectedDate: '2026-10-10',
    });
  });

  it('clamps the initial window to trip boundaries', () => {
    expect(
      getInitialItineraryWindow(trip, new Date('2026-09-01T00:00:00Z')),
    ).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      selectedDate: '2026-10-01',
    });
  });

  it('builds inclusive itinerary days', () => {
    expect(itineraryDays('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });
});
