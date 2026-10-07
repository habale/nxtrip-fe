import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-context';
import {
  getBookmarkRepository,
  type BookmarkRepository,
  type CreateBookmarkInput,
} from './bookmark-repository';

export const bookmarkKeys = {
  trip: (tripId: string, userId: string) =>
    ['bookmarks', tripId, userId] as const,
};

export function useTripBookmarks(
  tripId: string,
  repository?: BookmarkRepository,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: bookmarkKeys.trip(tripId, user?.id ?? 'anonymous'),
    enabled: Boolean(tripId && user),
    queryFn: () =>
      (repository ?? getBookmarkRepository()).listForTrip(
        tripId,
        user?.id ?? '',
      ),
  });
}

export function useCreateBookmark(repository?: BookmarkRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateBookmarkInput, 'ownerUserId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getBookmarkRepository()).create({
        ...input,
        ownerUserId: user.id,
      });
    },
    onSuccess: (bookmark) =>
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.trip(
          bookmark.source_trip_id ?? '',
          bookmark.owner_user_id,
        ),
      }),
  });
}
