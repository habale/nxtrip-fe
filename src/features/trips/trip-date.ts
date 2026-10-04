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
