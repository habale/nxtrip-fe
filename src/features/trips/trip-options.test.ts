import { describe, expect, it } from 'vitest';

import { getCurrencyLabel, getCurrencyOptions } from './trip-options';

describe('trip currency options', () => {
  it('shows the localized currency name and symbol', () => {
    const options = getCurrencyOptions('USD', 'en-US');

    expect(options.find(({ value }) => value === 'USD')?.label).toBe(
      'US Dollar ($)',
    );
    expect(options.find(({ value }) => value === 'THB')?.label).toBe(
      'Thai Baht (฿)',
    );
  });

  it('formats a stored trip currency for display', () => {
    expect(getCurrencyLabel('VND', 'en-US')).toBe('Vietnamese Dong (₫)');
  });
});
