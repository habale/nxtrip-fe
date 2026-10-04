import type { ItineraryNode } from './itinerary-types';
import { getItineraryCategory } from './itinerary-category';

const stop = {
  nodeType: 'stop',
  iconKey: 'hotel',
  additionalData: {},
} as ItineraryNode;

describe('itinerary categories', () => {
  it('uses the explicit data-driven category when present', () => {
    expect(
      getItineraryCategory({
        ...stop,
        additionalData: { category: 'Cafe' },
      }),
    ).toBe('cafe');
  });

  it('falls back to semantic icons and node behavior', () => {
    expect(getItineraryCategory(stop)).toBe('lodging');
    expect(
      getItineraryCategory({
        ...stop,
        nodeType: 'move',
        transportMode: 'rail',
        operator: null,
      }),
    ).toBe('moving');
  });

  it('uses misc for unknown stop categories', () => {
    expect(getItineraryCategory({ ...stop, iconKey: 'future-icon' })).toBe(
      'misc',
    );
  });
});
