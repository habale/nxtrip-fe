import { validateCreateTripForm } from './create-trip-form';

const validValues = {
  name: 'Japan',
  description: '',
  startDate: '2026-10-03',
  endDate: '2026-10-08',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
  currencyDecimalPlaces: 0,
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
});
