import {
  defaultMemberPermissions,
  hasTripPermission,
  normalizeTripPermissions,
} from './trip-permissions';

describe('trip permissions', () => {
  it('gives owners implicit access and members only explicit access', () => {
    expect(
      hasTripPermission({ role: 'owner', permissions: [] }, 'itinerary.manage'),
    ).toBe(true);
    expect(
      hasTripPermission(
        { role: 'member', permissions: ['ledger.manage'] },
        'ledger.manage',
      ),
    ).toBe(true);
    expect(
      hasTripPermission(
        { role: 'member', permissions: ['ledger.manage'] },
        'bookmarks.manage',
      ),
    ).toBe(false);
    expect(
      hasTripPermission(
        { role: 'viewer', permissions: ['itinerary.manage'] },
        'itinerary.manage',
      ),
    ).toBe(false);
  });

  it('drops unknown and duplicate values from database rows', () => {
    expect(
      normalizeTripPermissions([
        'ledger.manage',
        'unknown.manage',
        'ledger.manage',
      ]),
    ).toEqual(['ledger.manage']);
    expect(defaultMemberPermissions).toEqual(['ledger.manage']);
  });
});
