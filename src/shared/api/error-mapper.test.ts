import { AppError } from './app-error';
import { mapSupabaseError } from './error-mapper';

const requestId = '0193c784-7fcb-7c70-8e70-2bc27dbb31ca';

describe('mapSupabaseError', () => {
  it.each([
    ['PT401', 'AUTH_REQUIRED', 401],
    ['PT403', 'TRIP_ACCESS_DENIED', 403],
    ['PT409', 'LEDGER_NOT_EDITABLE', 409],
    ['PT422', 'EXPENSE_SHARE_MISMATCH', 422],
    ['PT422', 'ITINERARY_NODE_INVALID', 422],
  ] as const)(
    'maps known %s errors with message %s',
    (backendCode, message, expectedStatus) => {
      const error = mapSupabaseError({
        code: backendCode,
        message,
        details: `request_id=${requestId}`,
        hint: null,
      });

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: message,
        httpStatus: expectedStatus,
        requestId,
        translationKey: `errors:codes.${message}`,
      });
    },
  );

  it('does not trust a known message without a PTxxx status', () => {
    const error = mapSupabaseError({
      code: 'PGRST116',
      message: 'TRIP_ACCESS_DENIED',
      details: 'Unexpected PostgREST failure',
    });

    expect(error).toMatchObject({
      code: 'UNKNOWN',
      translationKey: 'errors:generic',
    });
  });

  it('maps unknown errors without exposing backend details', () => {
    const backendError = {
      code: 'XX000',
      message: 'sensitive database detail',
      details: 'internal diagnostic data',
    };
    const error = mapSupabaseError(backendError, requestId);

    expect(error).toMatchObject({
      name: 'AppError',
      code: 'UNKNOWN',
      requestId,
      translationKey: 'errors:generic',
    });
    expect(error.message).toBe('UNKNOWN');
    expect(error.cause).toBe(backendError);
  });

  it('preserves an existing AppError', () => {
    const original = new AppError('AUTH_REQUIRED', { requestId });

    expect(mapSupabaseError(original)).toBe(original);
  });
});
