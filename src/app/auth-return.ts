const AUTH_RETURN_KEY = 'nxtrip.auth.returnTo';

function safePath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null;
}

export function saveAuthReturnTo(path: string) {
  const safe = safePath(path);
  if (safe) sessionStorage.setItem(AUTH_RETURN_KEY, safe);
}

export function getAuthReturnTo() {
  return safePath(sessionStorage.getItem(AUTH_RETURN_KEY));
}

export function clearAuthReturnTo() {
  sessionStorage.removeItem(AUTH_RETURN_KEY);
}
