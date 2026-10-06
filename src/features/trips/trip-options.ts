import type { SelectOption } from '../../shared/ui';

const fallbackTimezones = [
  'UTC',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
];

const fallbackCurrencies = [
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'EUR',
  'GBP',
  'HKD',
  'JPY',
  'KRW',
  'SGD',
  'THB',
  'USD',
  'VND',
];

function supportedValues(key: 'currency' | 'timeZone', fallback: string[]) {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (value: 'currency' | 'timeZone') => string[];
    }
  ).supportedValuesOf;

  try {
    return supportedValuesOf ? supportedValuesOf(key) : fallback;
  } catch {
    return fallback;
  }
}

function options(values: string[], current?: string): SelectOption[] {
  return [...new Set([...(current ? [current] : []), ...values])]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

export function getCurrencyLabel(currency: string, locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(
      currency,
    );
    const symbol = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find(({ type }) => type === 'currency')?.value;

    if (name && symbol) return `${name} (${symbol})`;
    return name ?? currency;
  } catch {
    return currency;
  }
}

export function getTimezoneOptions(current?: string) {
  return options(supportedValues('timeZone', fallbackTimezones), current);
}

export function getCurrencyOptions(current?: string, locale = 'en') {
  return options(supportedValues('currency', fallbackCurrencies), current)
    .map((option) => ({
      ...option,
      label: getCurrencyLabel(option.value, locale),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}
