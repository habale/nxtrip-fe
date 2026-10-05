import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

function useRefreshItinerary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
}

export function useCreateItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const refresh = useRefreshItinerary();

  return useMutation({
    mutationFn: (input: Omit<SaveItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).createNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: refresh,
  });
}

export function useUpdateItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const refresh = useRefreshItinerary();

  return useMutation({
    mutationFn: (input: Omit<UpdateItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).updateNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: refresh,
  });
}

export function useRemoveItineraryNode(repository?: ItineraryRepository) {
  const { user } = useAuth();
  const refresh = useRefreshItinerary();

  return useMutation({
    mutationFn: (input: Omit<RemoveItineraryNodeInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).removeNode({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: refresh,
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
  const refresh = useRefreshItinerary();

  return useMutation({
    mutationFn: (input: Omit<AddNodeAttachmentInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getItineraryRepository()).addNodeAttachment({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: refresh,
  });
}
