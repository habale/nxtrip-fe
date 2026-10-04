import { useQuery } from '@tanstack/react-query';

import {
  getItineraryRepository,
  type ItineraryRepository,
} from './itinerary-repository';
import type { ItineraryDateWindow } from './itinerary-types';

export const itineraryKeys = {
  all: ['itinerary'] as const,
  window: ({ tripId, startDate, endDate }: ItineraryDateWindow) =>
    [...itineraryKeys.all, tripId, startDate, endDate] as const,
};

export function useItineraryWindow(
  window: ItineraryDateWindow,
  repository?: ItineraryRepository,
) {
  return useQuery({
    queryKey: itineraryKeys.window(window),
    enabled: Boolean(window.tripId && window.startDate && window.endDate),
    queryFn: () =>
      (repository ?? getItineraryRepository()).getDateWindow(window),
  });
}
