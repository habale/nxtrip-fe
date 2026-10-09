import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError } from '../../shared/api/app-error';
import { captureTelemetryEvent } from '../../shared/telemetry/faro';
import { useAuth } from '../auth/auth-context';
import {
  getTripRepository,
  type CreateTripInput,
  type AddGuestMemberInput,
  type DeactivateGuestMemberInput,
  type RemoveTripCoverInput,
  type TripDetail,
  type TripRepository,
  type UpdateTripCoverInput,
  type UpdateTripInput,
  type UpdateGuestMemberInput,
} from './trip-repository';

export const tripKeys = {
  all: ['trips'] as const,
  list: (userId: string) => [...tripKeys.all, 'list', userId] as const,
  detail: (tripId: string) => [...tripKeys.all, 'detail', tripId] as const,
  members: (tripId: string) => [...tripKeys.all, 'members', tripId] as const,
  invite: (tripId: string) => [...tripKeys.all, 'invite', tripId] as const,
};

export function useTripInvite(
  tripId: string,
  enabled: boolean,
  repository?: TripRepository,
) {
  return useQuery({
    queryKey: tripKeys.invite(tripId),
    enabled: Boolean(tripId && enabled),
    queryFn: () => (repository ?? getTripRepository()).getActiveInvite(tripId),
  });
}

export function useCreateTripInvite(repository?: TripRepository) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tripId: string) =>
      (repository ?? getTripRepository()).createInvite(tripId),
    onSuccess: (invite) => {
      queryClient.setQueryData(tripKeys.invite(invite.trip_id), invite);
      captureTelemetryEvent('trip_invite_created', {
        expiration_enabled: Boolean(invite.expires_at),
      });
    },
  });
}

export function useRevokeTripInvite(repository?: TripRepository) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ inviteId }: { tripId: string; inviteId: string }) =>
      (repository ?? getTripRepository()).revokeInvite(inviteId),
    onSuccess: (_result, { tripId }) => {
      queryClient.setQueryData(tripKeys.invite(tripId), null);
      captureTelemetryEvent('trip_invite_revoked');
    },
  });
}

export function useClaimTripMember(repository?: TripRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      tripMemberId,
    }: {
      tripId: string;
      tripMemberId: string;
    }) => (repository ?? getTripRepository()).claimMember(tripId, tripMemberId),
    onSuccess: (_memberId, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      void queryClient.invalidateQueries({
        queryKey: tripKeys.members(tripId),
      });
      if (user) {
        void queryClient.invalidateQueries({
          queryKey: tripKeys.list(user.id),
        });
      }
    },
  });
}

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

export function useTripMembers(tripId: string, repository?: TripRepository) {
  return useQuery({
    queryKey: tripKeys.members(tripId),
    enabled: Boolean(tripId),
    queryFn: () => (repository ?? getTripRepository()).listMembers(tripId),
  });
}

export function useAddGuestMember(repository?: TripRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<AddGuestMemberInput, 'createdBy'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getTripRepository()).addGuestMember({
        ...input,
        createdBy: user.id,
      });
    },
    onSuccess: async (member) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: tripKeys.members(member.member.trip_id),
        }),
        queryClient.invalidateQueries({
          queryKey: tripKeys.detail(member.member.trip_id),
        }),
        queryClient.invalidateQueries({
          queryKey: ['ledger', member.member.trip_id],
        }),
      ]);
    },
  });
}

function useRefreshMembers() {
  const queryClient = useQueryClient();
  return (tripId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripKeys.members(tripId) }),
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
      queryClient.invalidateQueries({ queryKey: ['ledger', tripId] }),
    ]);
}

export function useUpdateGuestMember(repository?: TripRepository) {
  const refreshMembers = useRefreshMembers();

  return useMutation({
    mutationFn: (input: UpdateGuestMemberInput) =>
      (repository ?? getTripRepository()).updateGuestMember(input),
    onSuccess: (member) => refreshMembers(member.member.trip_id),
  });
}

export function useDeactivateGuestMember(repository?: TripRepository) {
  const refreshMembers = useRefreshMembers();

  return useMutation({
    mutationFn: (input: DeactivateGuestMemberInput) =>
      (repository ?? getTripRepository()).deactivateGuestMember(input),
    onSuccess: (member) => refreshMembers(member.member.trip_id),
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

function useRefreshTripAfterCoverChange() {
  const queryClient = useQueryClient();

  return async (tripId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
      queryClient.invalidateQueries({ queryKey: tripKeys.all }),
    ]);
  };
}

export function useUpdateTripCover(repository?: TripRepository) {
  const refreshTrip = useRefreshTripAfterCoverChange();

  return useMutation({
    mutationFn: (input: UpdateTripCoverInput) =>
      (repository ?? getTripRepository()).updateCover(input),
    onSuccess: (trip) => refreshTrip(trip.id),
  });
}

export function useRemoveTripCover(repository?: TripRepository) {
  const refreshTrip = useRefreshTripAfterCoverChange();

  return useMutation({
    mutationFn: (input: RemoveTripCoverInput) =>
      (repository ?? getTripRepository()).removeCover(input),
    onSuccess: (trip) => refreshTrip(trip.id),
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
    onSuccess: async (_tripId, input) => {
      captureTelemetryEvent('trip_created', {
        currency: input.defaultCurrency,
      });
      await queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}

export function useJoinTrip(repository?: TripRepository) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) =>
      (repository ?? getTripRepository()).joinByCode(code),
    onMutate: () => {
      captureTelemetryEvent('trip_join_attempted');
    },
    onSuccess: async () => {
      captureTelemetryEvent('trip_join_succeeded');
      await queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
    onError: (error) => {
      captureTelemetryEvent('trip_join_failed', {
        error_code: error instanceof AppError ? error.code : 'UNKNOWN',
      });
    },
  });
}
