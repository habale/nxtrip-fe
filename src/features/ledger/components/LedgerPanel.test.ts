import { describe, expect, it } from 'vitest';

import {
  createDirectTransferSuggestions,
  createTreasurerSuggestion,
} from '../ledger-transfer-suggestions';

const members = ['A', 'B', 'C', 'D'].map((name) => ({
  id: name.toLowerCase(),
  display_name: name,
  avatar_url: null,
}));

function summary(index: number, balanceMinor: number) {
  return {
    member: members[index],
    paidMinor: 0,
    shareMinor: 0,
    depositMinor: 0,
    sponsorMinor: 0,
    transferSentMinor: 0,
    transferReceivedMinor: 0,
    balanceMinor,
  };
}

describe('ledger transfer suggestions', () => {
  it('pairs debtors with creditors without persisting a calculation run', () => {
    const suggestions = createDirectTransferSuggestions([
      summary(0, 400),
      summary(1, 100),
      summary(2, -200),
      summary(3, -300),
    ]);

    expect(suggestions).toEqual([
      {
        fromMember: members[2],
        toMember: members[0],
        amountMinor: 200,
      },
      {
        fromMember: members[3],
        toMember: members[0],
        amountMinor: 200,
      },
      {
        fromMember: members[3],
        toMember: members[1],
        amountMinor: 100,
      },
    ]);
  });

  it('routes positive and negative balances through the treasurer', () => {
    expect(createTreasurerSuggestion(summary(2, -200), members[0])).toEqual({
      fromMember: members[2],
      toMember: members[0],
      amountMinor: 200,
    });
    expect(createTreasurerSuggestion(summary(1, 100), members[0])).toEqual({
      fromMember: members[0],
      toMember: members[1],
      amountMinor: 100,
    });
    expect(createTreasurerSuggestion(summary(0, 400), members[0])).toBeNull();
  });
});
