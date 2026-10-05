import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-context';
import {
  getItineraryRepository,
  type AddNodeAttachmentInput,
  type ItineraryRepository,
  type RemoveItineraryNodeInput,
  type SaveItineraryNodeInput,
  type UpdateItineraryNodeInput,
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
