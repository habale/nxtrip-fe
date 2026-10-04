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

export function getInitialItineraryWindow(
  trip: Trip,
  now = new Date(),
): ItineraryDateWindow & { selectedDate: string } {
  const today = localDateForInstant(now, trip.timezone);
  const tripStart = trip.start_at
    ? localDateForInstant(new Date(trip.start_at), trip.timezone)
    : today;
  const tripEnd = trip.end_at
    ? localDateForInstant(new Date(trip.end_at), trip.timezone)
    : tripStart;
  const selectedDate =
    today < tripStart ? tripStart : today > tripEnd ? tripEnd : today;
  let startDate = addDays(selectedDate, -3);
  let endDate = addDays(startDate, ITINERARY_VIEW_DAYS - 1);

  if (startDate < tripStart) {
    startDate = tripStart;
    endDate = addDays(startDate, ITINERARY_VIEW_DAYS - 1);
  }
  if (endDate > tripEnd) {
    endDate = tripEnd;
    startDate = addDays(endDate, -(ITINERARY_VIEW_DAYS - 1));
    if (startDate < tripStart) startDate = tripStart;
  }

  return { tripId: trip.id, startDate, endDate, selectedDate };
}
