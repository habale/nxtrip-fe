import type { Database } from '../../shared/api/database.types';

export type LedgerMember = Pick<
  Database['public']['Tables']['trip_members']['Row'],
  'id' | 'display_name' | 'avatar_url'
>;

export type LedgerShare = {
  member: LedgerMember;
  amountMinor: number;
};

export type LedgerTransfer = {
  transfer: Database['public']['Tables']['trip_transfers']['Row'];
  fromMember: LedgerMember;
  toMember: LedgerMember;
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
  transfers: LedgerTransfer[];
  currentMemberId: string | null;
  treasurerMemberId: string | null;
  funds: Array<
    Pick<
      Database['public']['Tables']['trip_funds']['Row'],
      'id' | 'name' | 'currency'
    >
  >;
};

export type LedgerEntryType = 'expense' | 'transfer';
export type LedgerSplitMode = 'equal' | 'percent' | 'amount';

export type SaveLedgerEntryInput = {
  tripId: string;
  type: Exclude<LedgerEntryType, 'transfer'>;
  title: string;
  category: string;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  paidByMemberId: string;
  splitMode: LedgerSplitMode;
  shares: Array<{ memberId: string; amountMinor: number }>;
  userId: string;
  expenseId?: string;
};

export type RecordTripTransferInput = {
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  note?: string;
  transferId?: string;
};

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: string,
  decimalPlaces: number,
) {
  const value = fromStoredAmount(amountMinor, decimalPlaces);
  const symbol = getCurrencySymbol(currency, locale);
  const number = new Intl.NumberFormat(locale, {
    style: 'decimal',
    maximumFractionDigits: decimalPlaces,
    minimumFractionDigits: decimalPlaces,
    useGrouping: true,
  }).format(Math.abs(value));

  return `${value < 0 ? '−' : ''}${symbol}${number}`;
}

export function getCurrencySymbol(currency: string, locale: string) {
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find(({ type }) => type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

export function toStoredAmount(value: number, decimalPlaces: number) {
  return Math.round(value * 10 ** decimalPlaces);
}

export function fromStoredAmount(amount: number, decimalPlaces: number) {
  return amount / 10 ** decimalPlaces;
}

export function formatAmountInput(amount: number, decimalPlaces: number) {
  return fromStoredAmount(amount, decimalPlaces).toFixed(decimalPlaces);
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
