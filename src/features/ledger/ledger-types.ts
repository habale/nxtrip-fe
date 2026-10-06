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
  contributions: Array<{
    contribution: Database['public']['Tables']['fund_contributions']['Row'];
    member: LedgerMember | null;
    fundName: string;
    fundIsDefault: boolean;
  }>;
  members: LedgerMember[];
  funds: Array<
    Pick<
      Database['public']['Tables']['trip_funds']['Row'],
      'id' | 'name' | 'currency'
    >
  >;
  settlements: Database['public']['Tables']['settlements']['Row'][];
};

export type LedgerEntryType = 'expense' | 'sponsor' | 'deposit';
export type LedgerSplitMode = 'equal' | 'percent' | 'amount';

export type SaveLedgerEntryInput = {
  tripId: string;
  type: LedgerEntryType;
  title: string;
  category: string;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  paidByMemberId: string;
  splitMode: LedgerSplitMode;
  shares: Array<{ memberId: string; amountMinor: number }>;
  userId: string;
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
    currencyDisplay: 'narrowSymbol',
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
