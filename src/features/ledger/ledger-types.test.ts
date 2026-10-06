import { describe, expect, it } from 'vitest';

import {
  formatMoney,
  fromStoredAmount,
  ledgerDateKey,
  toStoredAmount,
} from './ledger-types';

describe('ledger formatting', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(32000, 'USD', 'en-US', 2)).toBe('$320.00');
    expect(formatMoney(32000, 'USD', 'vi-VN', 2)).toBe('$320,00');
  });

  it('converts amounts using the configured decimal places', () => {
    expect(toStoredAmount(12.34, 2)).toBe(1234);
    expect(fromStoredAmount(1234, 2)).toBe(12.34);
    expect(toStoredAmount(1234, 0)).toBe(1234);
    expect(formatMoney(1234, 'THB', 'en-US', 0)).toBe('฿1,234');
  });

  it('groups instants using the trip timezone', () => {
    expect(ledgerDateKey('2026-10-04T18:30:00.000Z', 'Asia/Bangkok')).toBe(
      '2026-10-05',
    );
  });
});
