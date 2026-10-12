import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getContactRepository,
  type ContactDraft,
  type ContactRepository,
} from './contact-repository';

export const contactKeys = {
  list: (tripId: string) => ['trip-contacts', tripId] as const,
};

export function useTripContacts(
  tripId: string,
  repository?: ContactRepository,
) {
  return useQuery({
    queryKey: contactKeys.list(tripId),
    enabled: Boolean(tripId),
    queryFn: () => (repository ?? getContactRepository()).list(tripId),
  });
}

export function useReplaceTripContacts(repository?: ContactRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      contacts,
    }: {
      tripId: string;
      contacts: ContactDraft[];
    }) => (repository ?? getContactRepository()).replace(tripId, contacts),
    onSuccess: (_result, { tripId }) =>
      queryClient.invalidateQueries({ queryKey: contactKeys.list(tripId) }),
  });
}
