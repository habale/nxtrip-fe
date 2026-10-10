export const tripPermissions = [
  'itinerary.manage',
  'ledger.manage',
  'bookmarks.manage',
] as const;

export type TripPermission = (typeof tripPermissions)[number];

export const defaultMemberPermissions: TripPermission[] = ['ledger.manage'];

export function normalizeTripPermissions(values: readonly string[]) {
  return tripPermissions.filter((permission) => values.includes(permission));
}

export function hasTripPermission(
  access: {
    role: 'owner' | 'member' | 'viewer';
    permissions: TripPermission[];
  },
  permission: TripPermission,
) {
  return (
    access.role === 'owner' ||
    (access.role === 'member' && access.permissions.includes(permission))
  );
}
