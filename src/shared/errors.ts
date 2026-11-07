// The only errors that ever cross from main to the window. Messages are
// fixed text written by us, never text from a bank, a library or the OS.

export const ERROR_MESSAGES = {
  NOT_IMPLEMENTED: "This part of the app is not built yet.",
  BAD_REQUEST: "The app sent an invalid request.",
  FORBIDDEN: "Request refused.",
  LOGIN_TIMEOUT: "The bank login was not completed in time.",
  LOGIN_CANCELLED: "The sync was cancelled or the bank window was closed.",
  BANK_CHANGED: "The bank website changed. An app update is needed.",
  BANK_ERROR: "The bank did not return your transactions. Try again later.",
  NETWORK: "Could not reach the bank. Check your internet connection.",
  BLOCKED_REQUEST: "Sync stopped: the bank page tried to contact an unexpected site.",
  BROWSER_MISSING: "The browser used for syncing is not installed.",
  SYNC_IN_PROGRESS: "A sync is already running.",
  DATABASE: "Could not read or write your data file.",
  UNKNOWN: "Something went wrong.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export interface AppError {
  code: ErrorCode;
  message: string;
}

/** Throw this inside main or core to send a known code to the window. */
export class CodedError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = "CodedError";
  }
}

export function toAppError(e: unknown): AppError {
  const code: ErrorCode = e instanceof CodedError ? e.code : "UNKNOWN";
  return { code, message: ERROR_MESSAGES[code] };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
