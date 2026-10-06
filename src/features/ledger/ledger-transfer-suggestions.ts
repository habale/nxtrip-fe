import type { LedgerMember } from './ledger-types';

export type TransferBalance = {
  member: LedgerMember;
  balanceMinor: number;
};

export type TransferSuggestion = {
  fromMember: LedgerMember;
  toMember: LedgerMember;
  amountMinor: number;
};

export function createDirectTransferSuggestions(
  summaries: TransferBalance[],
): TransferSuggestion[] {
  const debtors = summaries
    .filter(({ balanceMinor }) => balanceMinor < 0)
    .map((summary) => ({ ...summary, remaining: -summary.balanceMinor }));
  const creditors = summaries
    .filter(({ balanceMinor }) => balanceMinor > 0)
    .map((summary) => ({ ...summary, remaining: summary.balanceMinor }));
  const suggestions: TransferSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.remaining, creditor.remaining);
    if (amountMinor > 0) {
      suggestions.push({
        fromMember: debtor.member,
        toMember: creditor.member,
        amountMinor,
      });
    }
    debtor.remaining -= amountMinor;
    creditor.remaining -= amountMinor;
    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }

  return suggestions;
}

export function createTreasurerSuggestion(
  summary: TransferBalance,
  treasurer: LedgerMember,
): TransferSuggestion | null {
  if (summary.member.id === treasurer.id || summary.balanceMinor === 0) {
    return null;
  }
  return summary.balanceMinor < 0
    ? {
        fromMember: summary.member,
        toMember: treasurer,
        amountMinor: -summary.balanceMinor,
      }
    : {
        fromMember: treasurer,
        toMember: summary.member,
        amountMinor: summary.balanceMinor,
      };
}
