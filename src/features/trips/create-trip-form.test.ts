import { validateCreateTripForm } from './create-trip-form';

const validValues = {
  name: 'Japan',
  description: '',
  startDate: '2026-10-03',
  endDate: '2026-10-08',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
  currencyDecimalPlaces: 0,
  currencies: [{ currency: 'JPY', decimalPlaces: 0, rateToPrimary: 1 }],
};

describe('create trip form validation', () => {
  it('accepts valid values', () => {
    expect(validateCreateTripForm(validValues)).toEqual({});
  });

  it('requires a trimmed name and valid settings', () => {
    expect(
      validateCreateTripForm({
        ...validValues,
        name: '   ',
        timezone: 'Not/A_Timezone',
        defaultCurrency: 'dollars',
      }),
    ).toEqual({
      name: 'required',
      timezone: 'invalidTimezone',
      defaultCurrency: 'invalidCurrency',
    });
  });

  it('rejects an end date before the start date', () => {
    expect(
      validateCreateTripForm({
        ...validValues,
        startDate: '2026-10-08',
        endDate: '2026-10-03',
      }),
    ).toMatchObject({ endDate: 'endBeforeStart' });
  });

  it('accepts up to three unique currencies with primary-based rates', () => {
    expect(
      validateCreateTripForm({
        ...validValues,
        currencies: [
          { currency: 'VND', decimalPlaces: 0, rateToPrimary: 1 },
          { currency: 'THB', decimalPlaces: 2, rateToPrimary: 750 },
        ],
      }),
    ).toEqual({});
  });

  it('rejects duplicate currencies and invalid exchange rates', () => {
    expect(
      validateCreateTripForm({
        ...validValues,
        currencies: [
          { currency: 'VND', decimalPlaces: 0, rateToPrimary: 1 },
          { currency: 'VND', decimalPlaces: 0, rateToPrimary: 0 },
        ],
      }),
    ).toMatchObject({ currencies: 'invalidCurrencies' });
  });
});
