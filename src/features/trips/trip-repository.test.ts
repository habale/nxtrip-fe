import { mapCreateTripInput } from './trip-repository';

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
        createdBy: 'user-123',
      }),
    ).toEqual({
      name: 'Tokyo escape',
      description: null,
      start_at: '2026-10-02T15:00:00.000Z',
      end_at: '2026-10-07T15:00:00.000Z',
      timezone: 'Asia/Tokyo',
      default_currency: 'JPY',
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
      createdBy: 'user-123',
    });

    expect(mapped).toMatchObject({ start_at: null, end_at: null });
  });
});
