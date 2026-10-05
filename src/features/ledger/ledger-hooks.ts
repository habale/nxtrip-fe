import { useQuery } from '@tanstack/react-query';

import {
  getLedgerRepository,
  type LedgerRepository,
} from './ledger-repository';

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
