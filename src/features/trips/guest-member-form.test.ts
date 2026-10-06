import { validateGuestMemberForm } from './guest-member-form';

describe('guest member validation', () => {
  it('accepts a display name without account information', () => {
    expect(
      validateGuestMemberForm({
        displayName: 'Kenji Mori',
        email: '',
        note: '',
        isTreasurer: false,
      }),
    ).toEqual({});
  });

  it('requires a display name', () => {
    expect(
      validateGuestMemberForm({
        displayName: '  ',
        email: '',
        note: '',
        isTreasurer: false,
      }),
    ).toMatchObject({ displayName: 'required' });
  });

  it('validates an optional email when provided', () => {
    expect(
      validateGuestMemberForm({
        displayName: 'Kenji',
        email: 'not-an-email',
        note: '',
        isTreasurer: false,
      }),
    ).toMatchObject({ email: 'invalidEmail' });
  });
});
