import { mapCreateTripInput, mapUpdateTripInput } from './trip-repository';

describe('trip repository create mapping', () => {
  it('normalizes optional values and maps local dates in the trip timezone', () => {
    expect(
      mapCreateTripInput({
        name: '  Tokyo escape  ',
        description: '   ',
        startDate: '2026-10-03',
        endDate: '2026-10-08',
        timezone: 'Asia/Tokyo',
        defaultCurrency: 'jpy',
        currencyDecimalPlaces: 0,
        createdBy: 'user-123',
      }),
    ).toEqual({
      name: 'Tokyo escape',
      description: null,
      start_at: '2026-10-02T15:00:00.000Z',
      end_at: '2026-10-07T15:00:00.000Z',
      timezone: 'Asia/Tokyo',
      default_currency: 'JPY',
      currency_decimal_places: 0,
      created_by: 'user-123',
    });
  });

  it('keeps omitted dates null', () => {
    const mapped = mapCreateTripInput({
      name: 'Open ended trip',
      description: 'Later',
      startDate: '',
      endDate: '',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      currencyDecimalPlaces: 2,
      createdBy: 'user-123',
    });

    expect(mapped).toMatchObject({ start_at: null, end_at: null });
  });

  it('maps editable metadata without changing ownership', () => {
    expect(
      mapUpdateTripInput({
        tripId: 'trip-123',
        version: 4,
        name: ' Updated trip ',
        description: 'Notes',
        startDate: '',
        endDate: '',
        timezone: 'UTC',
        defaultCurrency: 'usd',
        currencyDecimalPlaces: 2,
      }),
    ).toEqual({
      name: 'Updated trip',
      description: 'Notes',
      start_at: null,
      end_at: null,
      timezone: 'UTC',
      default_currency: 'USD',
    });
  });
});
