import { getMemberManagementPermissions } from './member-permissions';
import type { TripMemberDetail } from './trip-repository';

function member(overrides: Partial<TripMemberDetail>): TripMemberDetail {
  return {
    member: {
      id: 'member-1',
      trip_id: 'trip-1',
      display_name: 'Guest',
      email: null,
      avatar_url: null,
      note: null,
      is_active: true,
      permissions: ['ledger.manage'],
      created_by: 'user-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      version: 1,
      deleted_at: null,
    },
    linkedUserId: null,
    role: null,
    accessStatus: null,
    ...overrides,
  };
}

describe('member management permissions', () => {
  it('keeps guest management read-only for regular members', () => {
    expect(getMemberManagementPermissions('member', member({}))).toEqual({
      canEdit: false,
      canDeactivate: false,
    });
  });

  it('lets owners edit linked members without allowing removal', () => {
    expect(
      getMemberManagementPermissions(
        'owner',
        member({ linkedUserId: 'user-2', role: 'member' }),
      ),
    ).toEqual({ canEdit: true, canDeactivate: false });
  });

  it('lets owners edit and remove active guest members', () => {
    expect(getMemberManagementPermissions('owner', member({}))).toEqual({
      canEdit: true,
      canDeactivate: true,
    });
  });

  it('does not let regular members edit another linked member', () => {
    expect(
      getMemberManagementPermissions(
        'member',
        member({ linkedUserId: 'user-2', role: 'member' }),
      ),
    ).toEqual({ canEdit: false, canDeactivate: false });
  });

  it('does not offer deactivation for an inactive guest', () => {
    const target = member({});
    target.member.is_active = false;
    expect(getMemberManagementPermissions('owner', target)).toEqual({
      canEdit: true,
      canDeactivate: false,
    });
  });
});
