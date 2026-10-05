const SORT_KEY_DIGITS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DEFAULT_DIGIT = SORT_KEY_DIGITS[Math.floor(SORT_KEY_DIGITS.length / 2)];
export const MAX_SORT_KEY_LENGTH = 128;

function digitIndex(character: string) {
  const index = SORT_KEY_DIGITS.indexOf(character);
  if (index === -1) {
    throw new RangeError(`Unsupported sort-key character: ${character}`);
  }
  return index;
}

function assertBound(key: string | null, name: string) {
  if (key === null) return;
  if (!key || key.length > MAX_SORT_KEY_LENGTH) {
    throw new RangeError(`${name} sort key has an invalid length.`);
  }
  for (const character of key) digitIndex(character);
}

function keyAfter(key: string) {
  return `${key}${DEFAULT_DIGIT}`;
}

export function generateSortKeyBetween(
  previous: string | null,
  next: string | null,
): string {
  assertBound(previous, 'Previous');
  assertBound(next, 'Next');
  if (previous === null && next === null) return DEFAULT_DIGIT;
  if (previous !== null && next !== null && previous >= next) {
    throw new RangeError('Previous sort key must precede the next sort key.');
  }

  let prefix = '';
  let offset = 0;
  while (
    previous !== null &&
    next !== null &&
    offset < previous.length &&
    offset < next.length &&
    previous[offset] === next[offset]
  ) {
    prefix += previous[offset];
    offset += 1;
  }

  const previousEnded = previous === null || offset >= previous.length;
  const nextEnded = next !== null && offset >= next.length;
  if (nextEnded) {
    throw new RangeError('No sort key exists between the supplied bounds.');
  }

  const lowerDigit = previousEnded ? -1 : digitIndex(previous[offset]);
  const upperDigit =
    next === null ? SORT_KEY_DIGITS.length : digitIndex(next[offset]);

  if (upperDigit - lowerDigit > 1) {
    const middleDigit = Math.floor((lowerDigit + upperDigit) / 2);
    const middle = SORT_KEY_DIGITS[middleDigit];
    const result = `${prefix}${middle}${
      previousEnded && middleDigit === 0 ? DEFAULT_DIGIT : ''
    }`;
    if (result.length > MAX_SORT_KEY_LENGTH) {
      throw new RangeError('The generated sort key is too long.');
    }
    return result;
  }

  if (previousEnded) {
    const nextSuffix = next?.slice(offset + 1) ?? '';
    if (!nextSuffix) {
      throw new RangeError('No sort key exists between the supplied bounds.');
    }
    const result = `${prefix}${next?.[offset]}${generateSortKeyBetween(
      null,
      nextSuffix,
    )}`;
    if (result.length > MAX_SORT_KEY_LENGTH) {
      throw new RangeError('The generated sort key is too long.');
    }
    return result;
  }

  const result = `${prefix}${previous[offset]}${keyAfter(
    previous.slice(offset + 1),
  )}`;
  if (result.length > MAX_SORT_KEY_LENGTH) {
    throw new RangeError('The generated sort key is too long.');
  }
  return result;
}
