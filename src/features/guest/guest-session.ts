const GUEST_CODE_KEY = 'nxtrip.guest.code';
const GUEST_CODE_PATTERN = /^(?:[0-9A-F]{16}|[0-9A-F]{32})$/;

export function normalizeGuestCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidGuestCode(value: string) {
  return GUEST_CODE_PATTERN.test(normalizeGuestCode(value));
}

export function readGuestCode() {
  return sessionStorage.getItem(GUEST_CODE_KEY) ?? '';
}

export function saveGuestCode(value: string) {
  const code = normalizeGuestCode(value);
  if (!isValidGuestCode(code)) return false;
  sessionStorage.setItem(GUEST_CODE_KEY, code);
  return true;
}

export function clearGuestCode() {
  sessionStorage.removeItem(GUEST_CODE_KEY);
}

export function consumeGuestCodeFromUrl() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const code = fragment.get('code');
  if (!code) return readGuestCode();

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
  if (saveGuestCode(code)) return normalizeGuestCode(code);
  clearGuestCode();
  return '';
}
