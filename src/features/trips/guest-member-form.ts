import type { TripPermission } from './trip-permissions';

export type GuestMemberFormValues = {
  displayName: string;
  email: string;
  note: string;
  isTreasurer: boolean;
  permissions: TripPermission[];
};

export type GuestMemberFormErrors = Partial<
  Record<keyof GuestMemberFormValues, 'required' | 'tooLong' | 'invalidEmail'>
>;

export function validateGuestMemberForm(values: GuestMemberFormValues) {
  const errors: GuestMemberFormErrors = {};
  const displayName = values.displayName.trim();
  const email = values.email.trim();

  if (!displayName) errors.displayName = 'required';
  else if (displayName.length > 120) errors.displayName = 'tooLong';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'invalidEmail';
  }

  return errors;
}
