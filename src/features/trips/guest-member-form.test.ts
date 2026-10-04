import { validateGuestMemberForm } from './guest-member-form';

describe('guest member validation', () => {
  it('accepts a display name without account information', () => {
    expect(
      validateGuestMemberForm({
        displayName: 'Kenji Mori',
        email: '',
        note: '',
      }),
    ).toEqual({});
  });

  it('requires a display name', () => {
    expect(
      validateGuestMemberForm({ displayName: '  ', email: '', note: '' }),
    ).toMatchObject({ displayName: 'required' });
  });

  it('validates an optional email when provided', () => {
    expect(
      validateGuestMemberForm({
        displayName: 'Kenji',
        email: 'not-an-email',
        note: '',
      }),
    ).toMatchObject({ email: 'invalidEmail' });
  });
});
