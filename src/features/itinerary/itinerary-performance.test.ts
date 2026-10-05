import { createLongItineraryFixture } from './testing/long-itinerary-fixture';
import {
  getAdjacentItineraryWindows,
  getItineraryWindowForDate,
  itineraryDays,
} from './itinerary-window';

describe('long itinerary performance fixture', () => {
  it('keeps a 70-day trip in bounded, reusable query windows', () => {
    const fixture = createLongItineraryFixture();
    const days = itineraryDays(fixture.startDate, fixture.endDate);
    const windows = days.map((day) =>
      getItineraryWindowForDate(fixture.trip, day),
    );
    const uniqueWindows = new Set(
      windows.map(({ startDate, endDate }) => `${startDate}:${endDate}`),
    );

    expect(days).toHaveLength(70);
    expect(fixture.nodes).toHaveLength(420);
    expect(uniqueWindows).toHaveLength(10);
    windows.forEach(({ startDate, endDate }) => {
      expect(itineraryDays(startDate, endDate).length).toBeLessThanOrEqual(7);
    });
  });

  it('prefetches only the chunks next to the current chunk', () => {
    const fixture = createLongItineraryFixture();
    const current = getItineraryWindowForDate(fixture.trip, '2099-02-05');
    const adjacent = getAdjacentItineraryWindows(fixture.trip, current);

    expect(adjacent).toHaveLength(2);
    expect(adjacent[0].endDate < current.startDate).toBe(true);
    expect(adjacent[1].startDate > current.endDate).toBe(true);
  });
});
