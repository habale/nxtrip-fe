import type { TripMemberDetail } from './trip-repository';

export type MemberManagementPermissions = {
  canEdit: boolean;
  canDeactivate: boolean;
};

export function getMemberManagementPermissions(
  viewerRole: 'owner' | 'member',
  target: TripMemberDetail,
): MemberManagementPermissions {
  const isGuest = !target.linkedUserId;

  return {
    canEdit: isGuest || viewerRole === 'owner',
    canDeactivate: isGuest && target.member.is_active,
  };
}
