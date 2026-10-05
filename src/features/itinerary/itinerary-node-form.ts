import {
  getItineraryCategory,
  type ItineraryCategory,
} from './itinerary-category';
import type { ItineraryNode } from './itinerary-types';

export type ItineraryNodeFormValues = {
  nodeType: 'stop' | 'move';
  category: ItineraryCategory;
  iconKey: string;
  title: string;
  localDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  notes: string;
  googleMapsUrl: string;
  transportMode: string;
  operator: string;
  durationMinutes: string;
};

export function localTimeFromInstant(instant: string | null, timeZone: string) {
  if (!instant) return '';
  const parts = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  })
    .formatToParts(new Date(instant))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.hour}:${parts.minute}`;
}

export function localDateTimeToIso(
  date: string,
  time: string,
  timeZone: string,
) {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
  let instant = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, Number(value)]),
    );
    const rendered = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant += target - rendered;
  }
  return new Date(instant).toISOString();
}

export function validateItineraryNodeForm(values: ItineraryNodeFormValues) {
  const errors: Partial<Record<keyof ItineraryNodeFormValues, string>> = {};
  if (!values.title.trim()) errors.title = 'required';
  else if (values.title.trim().length > 300) errors.title = 'titleTooLong';
  if (!values.localDate) errors.localDate = 'required';
  if (!values.allDay && values.endTime && !values.startTime) {
    errors.startTime = 'startRequired';
  }
  if (
    !values.allDay &&
    values.startTime &&
    values.endTime &&
    values.endTime < values.startTime
  ) {
    errors.endTime = 'endBeforeStart';
  }
  if (values.googleMapsUrl.trim()) {
    try {
      const url = new URL(values.googleMapsUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.googleMapsUrl = 'invalidUrl';
      }
    } catch {
      errors.googleMapsUrl = 'invalidUrl';
    }
  }
  if (
    values.durationMinutes &&
    (!/^\d+$/.test(values.durationMinutes) ||
      Number(values.durationMinutes) < 0)
  ) {
    errors.durationMinutes = 'invalidDuration';
  }
  return errors;
}

export function initialNodeFormValues(
  localDate: string,
  timeZone: string,
  node?: ItineraryNode,
): ItineraryNodeFormValues {
  const note = node?.additionalData.note;
  const category = node?.additionalData.category;
  return {
    nodeType: node?.nodeType === 'move' ? 'move' : 'stop',
    category:
      typeof category === 'string' && node
        ? getItineraryCategory(node)
        : node?.nodeType === 'move'
          ? 'moving'
          : 'misc',
    iconKey:
      node?.iconKey ??
      iconKeyByInitialCategory(node ? getItineraryCategory(node) : 'misc'),
    title: node?.title ?? '',
    localDate: node?.localDate ?? localDate,
    startTime: localTimeFromInstant(node?.startAt ?? null, timeZone),
    endTime: localTimeFromInstant(node?.endAt ?? null, timeZone),
    allDay: node?.allDay ?? false,
    notes:
      typeof note === 'string'
        ? note
        : (node?.additionalLines.map(({ text }) => text).join('\n') ?? ''),
    googleMapsUrl: node?.googleMapsUrl ?? '',
    transportMode: node?.nodeType === 'move' ? (node.transportMode ?? '') : '',
    operator: node?.nodeType === 'move' ? (node.operator ?? '') : '',
    durationMinutes: node?.durationMinutes?.toString() ?? '',
  };
}

function iconKeyByInitialCategory(category: ItineraryCategory) {
  const keys: Record<ItineraryCategory, string> = {
    moving: 'car',
    lodging: 'hotel',
    dining: 'restaurant',
    cafe: 'cafe',
    activity: 'activity',
    sightseeing: 'sightseeing',
    others: 'others',
    misc: 'misc',
    shopping: 'shopping',
  };
  return keys[category];
}
