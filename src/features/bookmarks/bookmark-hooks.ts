import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-context';
import {
  getBookmarkRepository,
  type BookmarkRepository,
  type CreateBookmarkInput,
  type RemoveBookmarkInput,
  type UpdateBookmarkInput,
} from './bookmark-repository';

export const bookmarkKeys = {
  trip: (tripId: string) => ['bookmarks', tripId] as const,
};

export function useTripBookmarks(
  tripId: string,
  repository?: BookmarkRepository,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...bookmarkKeys.trip(tripId), repository ? 'custom' : 'default'],
    enabled: Boolean(tripId && (user || repository)),
    queryFn: () => (repository ?? getBookmarkRepository()).listForTrip(tripId),
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
        queryKey: bookmarkKeys.trip(bookmark.source_trip_id ?? ''),
      }),
  });
}

export function useUpdateBookmark(repository?: BookmarkRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookmarkInput) =>
      (repository ?? getBookmarkRepository()).update(input),
    onSuccess: (bookmark) =>
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.trip(bookmark.source_trip_id ?? ''),
      }),
  });
}

export function useRemoveBookmark(repository?: BookmarkRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveBookmarkInput) =>
      (repository ?? getBookmarkRepository()).remove(input),
    onSuccess: (bookmark) =>
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.trip(bookmark.source_trip_id ?? ''),
      }),
  });
}
