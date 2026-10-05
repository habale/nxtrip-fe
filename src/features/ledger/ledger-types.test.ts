import { describe, expect, it } from 'vitest';

import { formatMoney, ledgerDateKey } from './ledger-types';

describe('ledger formatting', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(32000, 'USD', 'en-US')).toBe('$320.00');
  });

  it('groups instants using the trip timezone', () => {
    expect(ledgerDateKey('2026-10-04T18:30:00.000Z', 'Asia/Bangkok')).toBe(
      '2026-10-05',
    );
  });
});
