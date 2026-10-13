export function getAmountSuggestions(
  value: string,
  decimalPlaces: number,
): number[] {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) return [];

  const scale = 10 ** decimalPlaces;
  return [1_000, 10_000, 100_000]
    .map((multiplier) => Math.round(amount * multiplier * scale) / scale)
    .filter(
      (suggestion, index, suggestions) =>
        Number.isSafeInteger(Math.round(suggestion * scale)) &&
        suggestions.indexOf(suggestion) === index,
    );
}
