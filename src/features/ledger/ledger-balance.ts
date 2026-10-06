export type LedgerBalanceParts = {
  paidMinor: number;
  shareMinor: number;
  depositMinor: number;
  transferSentMinor: number;
  transferReceivedMinor: number;
};

// Positive means the member should receive money. Negative means the member
// still owes money. Sending a transfer moves a negative balance toward zero;
// receiving one moves a positive balance toward zero.
export function calculateLedgerBalanceMinor({
  paidMinor,
  shareMinor,
  depositMinor,
  transferSentMinor,
  transferReceivedMinor,
}: LedgerBalanceParts) {
  return (
    paidMinor +
    depositMinor -
    shareMinor +
    transferSentMinor -
    transferReceivedMinor
  );
}
