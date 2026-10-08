import { useQuery } from '@tanstack/react-query';

import { getGuestRepository } from './guest-repository';

export const guestKeys = { all: ['guest'] as const };

export function useGuestTrip(code: string) {
  return useQuery({
    queryKey: [...guestKeys.all, 'trip'],
    enabled: Boolean(code),
    retry: false,
    queryFn: () => getGuestRepository().getTrip(code),
  });
}

export function useGuestItinerary(
  code: string,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: [...guestKeys.all, 'itinerary', startDate, endDate],
    enabled: Boolean(code && startDate && endDate),
    retry: false,
    queryFn: () => getGuestRepository().getItinerary(code, startDate, endDate),
  });
}

export function useGuestBookmarks(code: string) {
  return useQuery({
    queryKey: [...guestKeys.all, 'bookmarks'],
    enabled: Boolean(code),
    retry: false,
    queryFn: () => getGuestRepository().getBookmarks(code),
  });
}
