import type { Database } from '../../shared/api/database.types';

export type LedgerMember = Pick<
  Database['public']['Tables']['trip_members']['Row'],
  'id' | 'display_name' | 'avatar_url'
>;

export type LedgerShare = {
  member: LedgerMember;
  amountMinor: number;
};

export type LedgerExpense = {
  expense: Database['public']['Tables']['expenses']['Row'];
  payer: LedgerMember | null;
  shares: LedgerShare[];
  attachmentCount: number;
  itineraryIconKey: string | null;
};

export type LedgerData = {
  expenses: LedgerExpense[];
  members: LedgerMember[];
};

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function ledgerDateKey(occurredAt: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date(occurredAt))
    .filter(({ type }) => type !== 'literal');
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
