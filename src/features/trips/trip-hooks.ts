import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-context';
import {
  getTripRepository,
  type CreateTripInput,
  type TripDetail,
  type TripRepository,
  type UpdateTripInput,
} from './trip-repository';

export const tripKeys = {
  all: ['trips'] as const,
  list: (userId: string) => [...tripKeys.all, 'list', userId] as const,
  detail: (tripId: string) => [...tripKeys.all, 'detail', tripId] as const,
};

export function useTripList(repository?: TripRepository) {
  const { user } = useAuth();

  return useQuery({
    queryKey: tripKeys.list(user?.id ?? 'anonymous'),
    enabled: Boolean(user),
    queryFn: () =>
      (repository ?? getTripRepository()).listAccessible(user?.id ?? ''),
  });
}

export function useTripDetail(tripId: string, repository?: TripRepository) {
  const { user } = useAuth();

  return useQuery({
    queryKey: tripKeys.detail(tripId),
    enabled: Boolean(tripId && user),
    queryFn: () =>
      (repository ?? getTripRepository()).getAccessibleById(
        tripId,
        user?.id ?? '',
      ),
  });
}

export function useUpdateTripMetadata(repository?: TripRepository) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTripInput) =>
      (repository ?? getTripRepository()).updateMetadata(input),
    onSuccess: async (trip) => {
      queryClient.setQueryData<TripDetail>(
        tripKeys.detail(trip.id),
        (current) => (current ? { ...current, trip } : current),
      );
      await queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}

export function useCreateTrip(repository?: TripRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<CreateTripInput, 'createdBy'>) => {
      if (!user) throw new Error('Authentication is required.');

      return (repository ?? getTripRepository()).create({
        ...input,
        createdBy: user.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}
