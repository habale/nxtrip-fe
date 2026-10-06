import type { TripMemberDetail } from './trip-repository';

export type MemberManagementPermissions = {
  canEdit: boolean;
  canDeactivate: boolean;
};

export function getMemberManagementPermissions(
  viewerRole: 'owner' | 'member' | 'viewer',
  target: TripMemberDetail,
): MemberManagementPermissions {
  return {
    canEdit: viewerRole === 'owner',
    canDeactivate:
      viewerRole === 'owner' && !target.linkedUserId && target.member.is_active,
  };
}
