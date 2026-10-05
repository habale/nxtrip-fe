import {
  MAX_SORT_KEY_LENGTH,
  generateSortKeyBetween,
} from './itinerary-sort-key';

describe('itinerary sort keys', () => {
  it('generates the first key without bounds', () => {
    expect(generateSortKeyBetween(null, null)).toBe('V');
  });

  it('generates keys before, between, and after existing nodes', () => {
    const before = generateSortKeyBetween(null, 'a0');
    const between = generateSortKeyBetween('a0', 'b0');
    const after = generateSortKeyBetween('b0', null);

    expect(before < 'a0').toBe(true);
    expect(between > 'a0' && between < 'b0').toBe(true);
    expect(after > 'b0').toBe(true);
  });

  it('supports repeated insertion into the same gap', () => {
    const first = generateSortKeyBetween('a0', 'b0');
    const second = generateSortKeyBetween('a0', first);
    const third = generateSortKeyBetween(second, first);

    expect(['a0', second, third, first, 'b0'].sort()).toEqual([
      'a0',
      second,
      third,
      first,
      'b0',
    ]);
  });

  it('supports repeated insertion at both ends', () => {
    let first = 'a0';
    let last = 'b0';

    for (let index = 0; index < 20; index += 1) {
      const nextFirst = generateSortKeyBetween(null, first);
      const nextLast = generateSortKeyBetween(last, null);
      expect(nextFirst < first).toBe(true);
      expect(nextLast > last).toBe(true);
      first = nextFirst;
      last = nextLast;
    }
  });

  it('rejects reversed, unsupported, exhausted, and oversized bounds', () => {
    expect(() => generateSortKeyBetween('b0', 'a0')).toThrow(RangeError);
    expect(() => generateSortKeyBetween('a-', 'b0')).toThrow(RangeError);
    expect(() => generateSortKeyBetween('a', 'a0')).toThrow(RangeError);
    expect(() =>
      generateSortKeyBetween('z'.repeat(MAX_SORT_KEY_LENGTH), null),
    ).toThrow(RangeError);
  });
});
