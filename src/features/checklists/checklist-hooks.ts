import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getChecklistRepository,
  type ChecklistRepository,
} from './checklist-repository';

export const checklistKeys = {
  all: ['checklists'] as const,
  detail: (tripId: string, checklistId: string) =>
    ['checklists', tripId, checklistId] as const,
};

export function useChecklist(
  tripId: string,
  checklistId: string,
  repository?: ChecklistRepository,
) {
  return useQuery({
    queryKey: checklistKeys.detail(tripId, checklistId),
    enabled: Boolean(tripId && checklistId),
    queryFn: () =>
      (repository ?? getChecklistRepository()).getById(tripId, checklistId),
  });
}

export function useCreateChecklist(repository?: ChecklistRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<ChecklistRepository['create']>[0]) =>
      (repository ?? getChecklistRepository()).create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['itinerary'] });
    },
  });
}

export function useUpdateChecklist(repository?: ChecklistRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<ChecklistRepository['update']>[0]) =>
      (repository ?? getChecklistRepository()).update(input),
    onSuccess: async (checklistId, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: checklistKeys.detail(input.tripId, checklistId),
        }),
        queryClient.invalidateQueries({ queryKey: ['itinerary'] }),
      ]);
    },
  });
}

export function useSetChecklistItemChecked(repository?: ChecklistRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tripId: string;
      checklistId: string;
      itemId: string;
      checked: boolean;
    }) =>
      (repository ?? getChecklistRepository()).setChecked(
        input.tripId,
        input.itemId,
        input.checked,
      ),
    onSuccess: async (_item, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: checklistKeys.detail(input.tripId, input.checklistId),
        }),
        queryClient.invalidateQueries({ queryKey: ['itinerary'] }),
      ]);
    },
  });
}
