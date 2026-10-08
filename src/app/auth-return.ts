const AUTH_RETURN_KEY = 'nxtrip.auth.returnTo';

function safePath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) return null;

  const pathname = value.split(/[?#]/, 1)[0];
  if (pathname === '/login' || pathname === '/guest') return null;
  return value;
}

export function saveAuthReturnTo(path: string) {
  const safe = safePath(path);
  if (safe) sessionStorage.setItem(AUTH_RETURN_KEY, safe);
}

export function getAuthReturnTo() {
  const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
  const safe = safePath(stored);
  if (stored && !safe) clearAuthReturnTo();
  return safe;
}

export function clearAuthReturnTo() {
  sessionStorage.removeItem(AUTH_RETURN_KEY);
}
