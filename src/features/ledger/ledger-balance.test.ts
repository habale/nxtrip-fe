import { describe, expect, it } from 'vitest';

import { calculateLedgerBalanceMinor } from './ledger-balance';

describe('ledger member balance', () => {
  it('reduces a debtor balance when the member sends money to the treasurer', () => {
    expect(
      calculateLedgerBalanceMinor({
        paidMinor: 0,
        shareMinor: 20_000,
        depositMinor: 0,
        transferSentMinor: 20_000,
        transferReceivedMinor: 0,
      }),
    ).toBe(0);
  });

  it('reduces a creditor balance when the member receives money from the treasurer', () => {
    expect(
      calculateLedgerBalanceMinor({
        paidMinor: 40_000,
        shareMinor: 0,
        depositMinor: 0,
        transferSentMinor: 0,
        transferReceivedMinor: 40_000,
      }),
    ).toBe(0);
  });

  it('includes both directions in the treasurer balance', () => {
    expect(
      calculateLedgerBalanceMinor({
        paidMinor: 10_000,
        shareMinor: 0,
        depositMinor: 0,
        transferSentMinor: 40_000,
        transferReceivedMinor: 50_000,
      }),
    ).toBe(0);
  });
});
