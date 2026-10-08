export function formatTripDateRange(
  startAt: string | null,
  endAt: string | null,
  locale: string,
  timeZone: string,
) {
  if (!startAt && !endAt) return null;

  const fullFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;
  const start = startDate ? fullFormatter.format(startDate) : null;
  const end = endDate ? fullFormatter.format(endDate) : null;

  if (
    startDate &&
    endDate &&
    fullFormatter.formatToParts(startDate).find(({ type }) => type === 'year')
      ?.value ===
      fullFormatter.formatToParts(endDate).find(({ type }) => type === 'year')
        ?.value
  ) {
    const startWithoutYear = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(startDate);

    return `${startWithoutYear} – ${end}`;
  }

  return start && end ? `${start} – ${end}` : (start ?? end);
}

export function tripInstantToLocalDate(
  instant: string | null,
  timeZone: string,
) {
  if (!instant) return '';

  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date(instant))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function deriveTripStatus(
  trip: {
    start_at: string | null;
    end_at: string | null;
    timezone: string;
  },
  now = new Date(),
): DerivedTripStatus {
  const today = tripInstantToLocalDate(now.toISOString(), trip.timezone);
  const startDate = tripInstantToLocalDate(trip.start_at, trip.timezone);
  const endDate = tripInstantToLocalDate(trip.end_at, trip.timezone);

  if (startDate && today < startDate) return 'planning';
  if (endDate && today > endDate) return 'completed';
  if (startDate && today >= startDate) return 'ongoing';
  return 'planning';
}

export function getTripDuration(
  startAt: string | null,
  endAt: string | null,
  timeZone: string,
) {
  if (!startAt || !endAt) return null;

  const startDate = tripInstantToLocalDate(startAt, timeZone);
  const endDate = tripInstantToLocalDate(endAt, timeZone);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const nights = Math.round(
    (Date.UTC(endYear, endMonth - 1, endDay) -
      Date.UTC(startYear, startMonth - 1, startDay)) /
      86_400_000,
  );

  if (nights < 0) return null;
  return { days: nights + 1, nights };
}

export function getTripProgress(
  trip: {
    start_at: string | null;
    end_at: string | null;
    timezone: string;
  },
  now = new Date(),
) {
  const duration = getTripDuration(trip.start_at, trip.end_at, trip.timezone);
  if (!duration || !trip.start_at) return null;

  const startDate = tripInstantToLocalDate(trip.start_at, trip.timezone);
  const today = tripInstantToLocalDate(now.toISOString(), trip.timezone);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const elapsedDays = Math.round(
    (Date.UTC(todayYear, todayMonth - 1, todayDay) -
      Date.UTC(startYear, startMonth - 1, startDay)) /
      86_400_000,
  );

  return {
    currentDay: Math.min(Math.max(elapsedDays + 1, 1), duration.days),
    totalDays: duration.days,
  };
}
export type DerivedTripStatus = 'planning' | 'ongoing' | 'completed';
