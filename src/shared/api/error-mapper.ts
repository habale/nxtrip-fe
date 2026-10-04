import { APP_ERROR_CODES, AppError, type KnownAppErrorCode } from './app-error';

type SupabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

const knownErrorCodes = new Set<string>(APP_ERROR_CODES);
const postgrestHttpCodePattern = /^PT([45]\d{2})$/;
const requestIdPattern =
  /(?:^|\s)request_id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\s|$)/i;

function isErrorLike(value: unknown): value is SupabaseErrorLike {
  return typeof value === 'object' && value !== null;
}

function getHttpStatus(code: unknown) {
  if (typeof code !== 'string') {
    return undefined;
  }

  const match = postgrestHttpCodePattern.exec(code);
  return match ? Number(match[1]) : undefined;
}

function getRequestId(details: unknown) {
  if (typeof details !== 'string') {
    return undefined;
  }

  return requestIdPattern.exec(details)?.[1];
}

function isKnownAppErrorCode(message: unknown): message is KnownAppErrorCode {
  return typeof message === 'string' && knownErrorCodes.has(message);
}

export function mapSupabaseError(
  error: unknown,
  fallbackRequestId?: string,
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (!isErrorLike(error)) {
    return new AppError('UNKNOWN', {
      requestId: fallbackRequestId,
      cause: error,
    });
  }

  const httpStatus = getHttpStatus(error.code);
  const requestId = getRequestId(error.details) ?? fallbackRequestId;

  if (httpStatus && isKnownAppErrorCode(error.message)) {
    return new AppError(error.message, {
      httpStatus,
      requestId,
      cause: error,
    });
  }

  return new AppError('UNKNOWN', {
    httpStatus,
    requestId,
    cause: error,
  });
}
