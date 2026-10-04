import type { TripMemberDetail } from './trip-repository';

export type MemberManagementPermissions = {
  canEdit: boolean;
  canDeactivate: boolean;
};

export function getMemberManagementPermissions(
  viewerRole: 'owner' | 'member',
  target: TripMemberDetail,
): MemberManagementPermissions {
  // Current RLS grants trip-member updates to every active trip member.
  // Keep the role argument in this boundary so future owner-only policy changes
  // stay centralized instead of spreading across components.
  void viewerRole;
  const isGuest = !target.linkedUserId;

  return {
    canEdit: isGuest,
    canDeactivate: isGuest && target.member.is_active,
  };
}
