import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { Icon } from './Icon';
import { Modal } from './Modal';

export type DateRangeValue = {
  startDate: string;
  endDate: string;
};

export type DateRangePickerProps = DateRangeValue & {
  label: string;
  errorText?: string;
  disabled?: boolean;
  onValueChange?: (value: DateRangeValue) => void;
};

const DAY_MS = 86_400_000;

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateValue(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function initialMonth(startDate: string) {
  const date = startDate ? parseDate(startDate) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function moveMonth(date: Date, amount: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
}

function calendarDays(month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const leadingDays = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(Date.UTC(year, monthIndex, index + 1)),
    ),
  ];
}

function rangeLength(startDate: string, endDate: string) {
  if (!startDate || !endDate) return undefined;
  return Math.round(
    (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / DAY_MS,
  );
}

function formatRange(
  startDate: string,
  endDate: string,
  locale: string,
  fullFormatter: Intl.DateTimeFormat,
) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const startText =
    start.getUTCFullYear() === end.getUTCFullYear()
      ? new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).format(start)
      : fullFormatter.format(start);

  return `${startText} – ${fullFormatter.format(end)}`;
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  errorText,
  disabled,
  onValueChange,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>({ startDate, endDate });
  const [month, setMonth] = useState(() => initialMonth(startDate));
  const days = useMemo(() => calendarDays(month), [month]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }),
    [locale],
  );
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [locale],
  );
  const nights = rangeLength(startDate, endDate);

  function openPicker() {
    setDraft({ startDate, endDate });
    setMonth(initialMonth(startDate));
    setOpen(true);
  }

  function selectDate(value: string) {
    if (!draft.startDate || draft.endDate || value < draft.startDate) {
      setDraft({ startDate: value, endDate: '' });
      return;
    }
    setDraft({ ...draft, endDate: value });
  }

  function apply() {
    onValueChange?.(draft);
    setOpen(false);
  }

  const summary = startDate
    ? endDate
      ? formatRange(startDate, endDate, locale, dateFormatter)
      : dateFormatter.format(parseDate(startDate))
    : t('dateRange.placeholder');

  return (
    <div className="ui-date-range">
      <button
        aria-expanded={open}
        className="ui-date-range__trigger"
        disabled={disabled}
        type="button"
        onClick={openPicker}
      >
        <span className="ui-date-range__icon">
          <Icon name="calendar" />
        </span>
        <span className="ui-date-range__value">
          <span>{label}</span>
          <strong className={startDate ? '' : 'ui-date-range__placeholder'}>
            {summary}
          </strong>
          {nights !== undefined && (
            <small>
              {t('dateRange.duration', { days: nights + 1, nights })}
            </small>
          )}
        </span>
        <Icon name="forward" />
      </button>
      {errorText && <span className="ui-field-error">{errorText}</span>}

      <Modal open={open} title={label} onDismiss={() => setOpen(false)}>
        <div className="ui-date-range__modal">
          <div className="ui-date-range__draft">
            <div>
              <span>{t('dateRange.start')}</span>
              <strong>
                {draft.startDate
                  ? dateFormatter.format(parseDate(draft.startDate))
                  : '—'}
              </strong>
            </div>
            <Icon name="forward" />
            <div>
              <span>{t('dateRange.end')}</span>
              <strong>
                {draft.endDate
                  ? dateFormatter.format(parseDate(draft.endDate))
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="ui-date-range__month-nav">
            <Button
              ariaLabel={t('dateRange.previousMonth')}
              variant="quiet"
              onClick={() => setMonth((value) => moveMonth(value, -1))}
            >
              <Icon name="previous" size="large" />
            </Button>
            <strong aria-live="polite">{monthFormatter.format(month)}</strong>
            <Button
              ariaLabel={t('dateRange.nextMonth')}
              variant="quiet"
              onClick={() => setMonth((value) => moveMonth(value, 1))}
            >
              <Icon name="forward" size="large" />
            </Button>
          </div>

          <div className="ui-date-range__calendar" role="grid">
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date(Date.UTC(2026, 10, 1 + index));
              return <span key={index}>{weekdayFormatter.format(date)}</span>;
            })}
            {days.map((date, index) => {
              if (!date) return <i key={`empty-${index}`} />;
              const value = toDateValue(date);
              const isEdge =
                value === draft.startDate || value === draft.endDate;
              const isInRange = Boolean(
                draft.startDate &&
                draft.endDate &&
                value > draft.startDate &&
                value < draft.endDate,
              );
              const isToday = value === toDateValue(new Date());

              return (
                <button
                  key={value}
                  aria-label={dateFormatter.format(date)}
                  aria-pressed={isEdge}
                  className={`${isEdge ? 'is-selected ' : ''}${isInRange ? 'is-in-range ' : ''}${isToday ? 'is-today' : ''}`}
                  type="button"
                  onClick={() => selectDate(value)}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <p className="ui-date-range__hint">
            {!draft.startDate
              ? t('dateRange.selectStart')
              : !draft.endDate
                ? t('dateRange.selectEnd')
                : ''}
          </p>

          <div className="ui-date-range__actions">
            <Button
              variant="quiet"
              onClick={() => setDraft({ startDate: '', endDate: '' })}
            >
              {t('actions.clear')}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              disabled={Boolean(draft.startDate && !draft.endDate)}
              onClick={apply}
            >
              {t('actions.apply')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
