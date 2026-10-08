import {
  clearGuestCode,
  consumeGuestCodeFromUrl,
  isValidGuestCode,
  readGuestCode,
  saveGuestCode,
} from './guest-session';

describe('guest session', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/guest');
  });

  it('consumes a link code without leaving it in browser history', () => {
    window.history.replaceState(
      {},
      '',
      '/guest#code=0123456789ABCDEF0123456789ABCDEF',
    );

    expect(consumeGuestCodeFromUrl()).toBe('0123456789ABCDEF0123456789ABCDEF');
    expect(window.location.hash).toBe('');
    expect(readGuestCode()).toBe('0123456789ABCDEF0123456789ABCDEF');
  });

  it('accepts migration and current codes but rejects arbitrary input', () => {
    expect(isValidGuestCode('0123456789abcdef')).toBe(true);
    expect(isValidGuestCode('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(saveGuestCode('not-a-code')).toBe(false);
    expect(readGuestCode()).toBe('');
  });

  it('clears guest access', () => {
    saveGuestCode('0123456789ABCDEF');
    clearGuestCode();
    expect(readGuestCode()).toBe('');
  });
});
