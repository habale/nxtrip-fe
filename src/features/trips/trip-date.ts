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
