import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-context';
import {
  getLedgerRepository,
  type LedgerRepository,
} from './ledger-repository';
import type { SaveLedgerEntryInput } from './ledger-types';

export const ledgerKeys = {
  all: ['ledger'] as const,
  expenses: (tripId: string) =>
    [...ledgerKeys.all, tripId, 'expenses'] as const,
};

export function useLedgerExpenses(
  tripId: string,
  repository?: LedgerRepository,
) {
  return useQuery({
    queryKey: ledgerKeys.expenses(tripId),
    enabled: Boolean(tripId),
    queryFn: () => (repository ?? getLedgerRepository()).listExpenses(tripId),
  });
}

export function useSaveLedgerEntry(repository?: LedgerRepository) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SaveLedgerEntryInput, 'userId'>) => {
      if (!user) throw new Error('Authentication is required.');
      return (repository ?? getLedgerRepository()).saveEntry({
        ...input,
        userId: user.id,
      });
    },
    onSuccess: async (_id, input) => {
      await queryClient.invalidateQueries({
        queryKey: ledgerKeys.expenses(input.tripId),
      });
    },
  });
}

export function useMarkMemberSettled(
  tripId: string,
  repository?: LedgerRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementIds: string[]) =>
      (repository ?? getLedgerRepository()).markSettlementsDone(settlementIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ledgerKeys.expenses(tripId),
      });
    },
  });
}
