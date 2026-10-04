export function normalizeTripCode(value: string) {
  return value.trim().toUpperCase();
}

export function validateTripCode(value: string) {
  const code = normalizeTripCode(value);

  if (!code) return 'required' as const;
  if (code.length < 4 || code.length > 128) return 'invalid' as const;
  return undefined;
}
