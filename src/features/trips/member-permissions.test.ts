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
  it('allows current trip members to manage active guests', () => {
    expect(getMemberManagementPermissions('member', member({}))).toEqual({
      canEdit: true,
      canDeactivate: true,
    });
  });

  it('protects linked account members from guest actions', () => {
    expect(
      getMemberManagementPermissions(
        'owner',
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
