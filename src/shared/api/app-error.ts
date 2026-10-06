export const APP_ERROR_CODES = [
  'AUTH_REQUIRED',
  'USER_PROFILE_NOT_FOUND',
  'TRIP_NOT_FOUND',
  'TRIP_ACCESS_DENIED',
  'TRIP_INVITE_UNAVAILABLE',
  'LEDGER_NOT_EDITABLE',
  'EXPENSE_AMOUNT_INVALID',
  'EXPENSE_TITLE_REQUIRED',
  'EXPENSE_MEMBERS_REQUIRED',
  'EXPENSE_SPLIT_DUPLICATE_MEMBER',
  'EXPENSE_MEMBER_INVALID',
  'EXPENSE_PAYER_CONFIGURATION_INVALID',
  'EXPENSE_PAYER_MEMBER_INVALID',
  'EXPENSE_PAYER_FUND_INVALID',
  'EXPENSE_SPLIT_METHOD_UNSUPPORTED',
  'EXPENSE_NOT_FOUND',
  'EXPENSE_TRIP_MISMATCH',
  'EXPENSE_SHARE_AMOUNT_INVALID',
  'EXPENSE_SHARE_MISMATCH',
  'ITINERARY_NODE_INVALID',
  'TRANSFER_RECORD_FORBIDDEN',
  'TRANSFER_MEMBERS_SAME',
  'TRANSFER_AMOUNT_INVALID',
  'TRANSFER_CURRENCY_INVALID',
  'TRANSFER_MEMBER_INVALID',
  'TREASURER_UPDATE_FORBIDDEN',
  'TREASURER_MEMBER_INVALID',
] as const;

export type KnownAppErrorCode = (typeof APP_ERROR_CODES)[number];
export type AppErrorCode = KnownAppErrorCode | 'UNKNOWN';
export type AppErrorTranslationKey =
  `errors:codes.${KnownAppErrorCode}` | 'errors:generic';

type AppErrorOptions = {
  requestId?: string;
  httpStatus?: number;
  cause?: unknown;
};

export function getAppErrorTranslationKey(
  code: AppErrorCode,
): AppErrorTranslationKey {
  return code === 'UNKNOWN' ? 'errors:generic' : `errors:codes.${code}`;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly translationKey: AppErrorTranslationKey;
  readonly requestId?: string;
  readonly httpStatus?: number;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(code, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.translationKey = getAppErrorTranslationKey(code);
    this.requestId = options.requestId;
    this.httpStatus = options.httpStatus;
  }
}
