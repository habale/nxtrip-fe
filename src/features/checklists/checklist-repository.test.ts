import { serializeChecklistItems } from './checklist-repository';

describe('serializeChecklistItems', () => {
  it('preserves the chosen order and trims labels for atomic saves', () => {
    expect(
      serializeChecklistItems([
        { id: 'second', label: '  Buy SIM cards  ' },
        { id: 'first', label: 'Check passports' },
      ]),
    ).toEqual([
      { id: 'second', label: 'Buy SIM cards', sort_key: '000000' },
      { id: 'first', label: 'Check passports', sort_key: '000001' },
    ]);
  });
});
