import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '../auth/auth-context';
import {
  getItineraryRepository,
  type AddNodeAttachmentInput,
  type ItineraryRepository,
  type RemoveItineraryNodeInput,
  type ReorderItineraryNodeInput,
  type SaveItineraryNodeInput,
  type UpdateItineraryNodeInput,
} from './itinerary-repository';
import type { ItineraryDateWindow, ItineraryWindow } from './itinerary-types';

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

export function usePrefetchItineraryWindows(
  windows: ItineraryDateWindow[],
  repository?: ItineraryRepository,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const itineraryRepository = repository ?? getItineraryRepository();
    windows.forEach((window) => {
      void queryClient.prefetchQuery({
        queryKey: itineraryKeys.window(window),
        queryFn: () => itineraryRepository.getDateWindow(window),
      });
    });
  }, [queryClient, repository, windows]);
}

function invalidateItineraryDay(
  queryClient: QueryClient,
  tripId: string,
  localDate: string,
) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === itineraryKeys.all[0] &&
      queryKey[1] === tripId &&
      typeof queryKey[2] === 'string' &&
      typeof queryKey[3] === 'string' &&
      queryKey[2] <= localDate &&
      queryKey[3] >= localDate,
  });
}

export function useCreateItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<SaveItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).createNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: (node) =>
      invalidateItineraryDay(queryClient, node.tripId, node.localDate ?? ''),
  });
}

export function useUpdateItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpdateItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).updateNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: (node) =>
      invalidateItineraryDay(queryClient, node.tripId, node.localDate ?? ''),
  });
}

export function useRemoveItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<RemoveItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).removeNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: (_result, input) =>
      invalidateItineraryDay(queryClient, input.tripId, input.localDate),
  });
}

export function useReorderItineraryNode(
  window: ItineraryDateWindow,
  repository?: ItineraryRepository,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = itineraryKeys.window(window);

  return useMutation({
    mutationFn: (input: Omit<ReorderItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).reorderNode({
        ...input,
        userId: user.id,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ItineraryWindow>(queryKey);
      queryClient.setQueryData<ItineraryWindow>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          nodes: current.nodes
            .map((node) =>
              node.id === input.nodeId
                ? { ...node, sortKey: input.sortKey }
                : node,
            )
            .sort((left, right) => {
              const dateOrder = (left.localDate ?? '').localeCompare(
                right.localDate ?? '',
              );
              if (dateOrder !== 0) return dateOrder;
              return left.sortKey < right.sortKey
                ? -1
                : left.sortKey > right.sortKey
                  ? 1
                  : 0;
            }),
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useAddItineraryNodeAttachment(
  repository?: ItineraryRepository,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<AddNodeAttachmentInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).addNodeAttachment({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: (_result, input) =>
      invalidateItineraryDay(queryClient, input.tripId, input.localDate),
  });
}
