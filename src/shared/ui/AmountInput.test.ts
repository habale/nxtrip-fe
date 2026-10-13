import { describe, expect, it } from 'vitest';

import { getAmountSuggestions } from './amount-input-suggestions';

describe('amount input suggestions', () => {
  it('suggests three useful magnitudes by appending zeroes', () => {
    expect(getAmountSuggestions('4', 0)).toEqual([4_000, 40_000, 400_000]);
  });

  it('supports currencies with decimal places', () => {
    expect(getAmountSuggestions('4.25', 2)).toEqual([4_250, 42_500, 425_000]);
  });

  it('does not suggest values for empty, invalid, or non-positive input', () => {
    expect(getAmountSuggestions('', 0)).toEqual([]);
    expect(getAmountSuggestions('nope', 0)).toEqual([]);
    expect(getAmountSuggestions('0', 0)).toEqual([]);
  });
});
