import {
  localDateTimeToIso,
  validateItineraryNodeForm,
  type ItineraryNodeFormValues,
} from './itinerary-node-form';

const validValues: ItineraryNodeFormValues = {
  nodeType: 'stop',
  category: 'sightseeing',
  iconKey: 'sightseeing',
  title: 'Wat Arun',
  localDate: '2026-10-04',
  startTime: '09:30',
  endTime: '11:00',
  allDay: false,
  notes: '',
  googleMapsUrl: 'https://maps.google.com/example',
  transportMode: '',
  operator: '',
  durationMinutes: '',
};

describe('itinerary node form', () => {
  it('maps local date and time through the trip timezone', () => {
    expect(localDateTimeToIso('2026-10-04', '09:30', 'Asia/Ho_Chi_Minh')).toBe(
      '2026-10-04T02:30:00.000Z',
    );
  });

  it('validates ordering, URLs, and duration', () => {
    expect(validateItineraryNodeForm(validValues)).toEqual({});
    expect(
      validateItineraryNodeForm({
        ...validValues,
        endTime: '08:00',
        googleMapsUrl: 'javascript:alert(1)',
        durationMinutes: '-1',
      }),
    ).toMatchObject({
      endTime: 'endBeforeStart',
      googleMapsUrl: 'invalidUrl',
      durationMinutes: 'invalidDuration',
    });
  });
});
