import type { Trip } from '../trips/trip-repository';
import type { ItineraryDateWindow } from './itinerary-types';

export const ITINERARY_VIEW_DAYS = 7;

function dateFromValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function valueFromDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function addDays(value: string, amount: number) {
  const date = dateFromValue(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return valueFromDate(date);
}

export function localDateForInstant(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function itineraryDays(startDate: string, endDate: string) {
  const days: string[] = [];
  for (let value = startDate; value <= endDate; value = addDays(value, 1)) {
    days.push(value);
  }
  return days;
}

export function getTripItineraryBounds(trip: Trip, fallbackDate: string) {
  const startDate = trip.start_at
    ? localDateForInstant(new Date(trip.start_at), trip.timezone)
    : fallbackDate;
  const endDate = trip.end_at
    ? localDateForInstant(new Date(trip.end_at), trip.timezone)
    : startDate;
  return { startDate, endDate };
}

export function getItineraryWindowForDate(trip: Trip, requestedDate: string) {
  const bounds = getTripItineraryBounds(trip, requestedDate);
  const selectedDate =
    requestedDate < bounds.startDate
      ? bounds.startDate
      : requestedDate > bounds.endDate
        ? bounds.endDate
        : requestedDate;
  const tripStart = dateFromValue(bounds.startDate).getTime();
  const selected = dateFromValue(selectedDate).getTime();
  const dayOffset = Math.round((selected - tripStart) / 86_400_000);
  const chunkOffset = Math.floor(dayOffset / ITINERARY_VIEW_DAYS);
  const startDate = addDays(
    bounds.startDate,
    chunkOffset * ITINERARY_VIEW_DAYS,
  );
  const candidateEnd = addDays(startDate, ITINERARY_VIEW_DAYS - 1);

  return {
    tripId: trip.id,
    startDate,
    endDate: candidateEnd > bounds.endDate ? bounds.endDate : candidateEnd,
  };
}

export function getAdjacentItineraryWindows(
  trip: Trip,
  window: ItineraryDateWindow,
) {
  const bounds = getTripItineraryBounds(trip, window.startDate);
  const adjacent: ItineraryDateWindow[] = [];
  if (window.startDate > bounds.startDate) {
    adjacent.push(
      getItineraryWindowForDate(trip, addDays(window.startDate, -1)),
    );
  }
  if (window.endDate < bounds.endDate) {
    adjacent.push(getItineraryWindowForDate(trip, addDays(window.endDate, 1)));
  }
  return adjacent;
}

export function getInitialItineraryWindow(
  trip: Trip,
  now = new Date(),
): ItineraryDateWindow & { selectedDate: string } {
  const today = localDateForInstant(now, trip.timezone);
  const { startDate: tripStart, endDate: tripEnd } = getTripItineraryBounds(
    trip,
    today,
  );
  const selectedDate =
    today < tripStart ? tripStart : today > tripEnd ? tripEnd : today;
  const { startDate, endDate } = getItineraryWindowForDate(trip, selectedDate);

  return { tripId: trip.id, startDate, endDate, selectedDate };
}
