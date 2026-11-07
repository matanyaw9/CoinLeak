// Turns every library outcome and thrown error into one of our fixed codes.
// Library, browser and bank text is read here only to classify; it never
// goes into an error, a log line or a return value.

import type { ScraperScrapingResult } from "israeli-bank-scrapers";
import type { ScraperErrorTypes } from "israeli-bank-scrapers/lib/scrapers/errors.js";
import { CodedError, type ErrorCode } from "@shared/errors";

// Exhaustive on purpose: a library upgrade that adds an error type fails typecheck here.
const BY_ERROR_TYPE: Record<`${ScraperErrorTypes}`, ErrorCode> = {
  // The library wanted to drive 2FA itself: its flow no longer matches ours.
  TWO_FACTOR_RETRIEVER_MISSING: "BANK_CHANGED",
  // The next three come from the library's own login, which self-login replaces.
  INVALID_PASSWORD: "BANK_ERROR",
  CHANGE_PASSWORD: "BANK_ERROR",
  ACCOUNT_BLOCKED: "BANK_ERROR",
  // Library waits (session data, API answers) that ran out during download.
  TIMEOUT: "BANK_ERROR",
  // Any exception inside the library's download code.
  GENERIC: "BANK_ERROR",
  GENERAL_ERROR: "BANK_ERROR",
};

function isKnownErrorType(t: string): t is keyof typeof BY_ERROR_TYPE {
  return Object.hasOwn(BY_ERROR_TYPE, t);
}

/** The code for a finished library run, or null when it returned data. */
export function codeForResult(result: ScraperScrapingResult): ErrorCode | null {
  if (result.success) return Array.isArray(result.accounts) ? null : "BANK_CHANGED";
  const type = result.errorType ?? "";
  return isKnownErrorType(type) ? BY_ERROR_TYPE[type] : "UNKNOWN";
}

/** The code for something thrown during our own steps (navigation, waiting). */
export function codeForThrown(e: unknown): ErrorCode {
  if (e instanceof CodedError) return e.code;
  if (!(e instanceof Error)) return "UNKNOWN";
  if (e.message.startsWith("net::ERR_BLOCKED_BY_CLIENT")) return "BLOCKED_REQUEST";
  if (e.message.startsWith("net::ERR_") || e.name === "TimeoutError") return "NETWORK";
  // The library's navigateTo() when the bank answers with an HTTP error status.
  if (e.message.startsWith("Failed to navigate")) return "BANK_ERROR";
  return "UNKNOWN";
}

/** A fresh CodedError: never wraps, chains or copies the original. */
export function toCodedError(e: unknown): CodedError {
  return new CodedError(codeForThrown(e));
}
