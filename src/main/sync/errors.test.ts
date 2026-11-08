// Every library outcome maps to a code, and no library text survives.

import { describe, expect, it } from "vitest";
import { CodedError, ERROR_MESSAGES, toAppError } from "@shared/errors";
import { codeForResult, codeForThrown, toCodedError } from "./errors";

const FAKE_PASSWORD = "Hunter2-FAKE-pw!";

const LIBRARY_ERROR_TYPES = [
  "TWO_FACTOR_RETRIEVER_MISSING",
  "INVALID_PASSWORD",
  "CHANGE_PASSWORD",
  "TIMEOUT",
  "ACCOUNT_BLOCKED",
  "GENERIC",
  "GENERAL_ERROR",
] as const;

/** Everything a CodedError could carry to a log, the window or a file. */
function everythingVisible(e: CodedError): string {
  return [e.message, e.stack ?? "", String(e), JSON.stringify(e), JSON.stringify(toAppError(e)), Object.keys(e).join()].join(
    "\n",
  );
}

describe("codeForResult", () => {
  it.each(LIBRARY_ERROR_TYPES)("maps library error type %s to one of our codes", (errorType) => {
    const code = codeForResult({ success: false, errorType: errorType as never });
    expect(code).not.toBeNull();
    expect(Object.keys(ERROR_MESSAGES)).toContain(code);
    expect(code).not.toBe("UNKNOWN");
  });

  it("covers every error type the installed library defines", async () => {
    const { ScraperErrorTypes } = await import("israeli-bank-scrapers/lib/scrapers/errors.js");
    expect([...Object.values(ScraperErrorTypes)].sort()).toEqual([...LIBRARY_ERROR_TYPES].sort());
  });

  it("maps an unknown error type to UNKNOWN", () => {
    expect(codeForResult({ success: false, errorType: "SOMETHING_NEW" as never })).toBe("UNKNOWN");
  });

  it("maps a failure without an error type (Behatsdaa's empty answer) to BANK_ERROR", () => {
    expect(codeForResult({ success: false })).toBe("BANK_ERROR");
    expect(codeForResult({ success: false, errorMessage: `TokenNotFound ${FAKE_PASSWORD}` })).toBe("BANK_ERROR");
  });

  it("returns null for data and BANK_CHANGED for a success without accounts", () => {
    expect(codeForResult({ success: true, accounts: [] })).toBeNull();
    expect(codeForResult({ success: true })).toBe("BANK_CHANGED");
  });

  it("never lets library message text survive (fake password test)", () => {
    for (const errorType of LIBRARY_ERROR_TYPES) {
      const result = {
        success: false,
        errorType: errorType as never,
        errorMessage: `Login failed for user 012345678 with password ${FAKE_PASSWORD}`,
      };
      const code = codeForResult(result);
      const err = new CodedError(code ?? "UNKNOWN");
      expect(everythingVisible(err)).not.toContain(FAKE_PASSWORD);
      expect(everythingVisible(err)).not.toContain("012345678");
    }
  });
});

describe("codeForThrown", () => {
  it.each([
    ["net::ERR_BLOCKED_BY_CLIENT at https://evil.example/", "BLOCKED_REQUEST"],
    ["net::ERR_NAME_NOT_RESOLVED at https://start.telebank.co.il/login", "NETWORK"],
    ["net::ERR_INTERNET_DISCONNECTED at https://www.cal-online.co.il/", "NETWORK"],
    ["Failed to navigate to url https://start.telebank.co.il/login, status code: 503", "BANK_ERROR"],
    ["Something unexpected", "UNKNOWN"],
  ] as const)("classifies %s", (message, code) => {
    expect(codeForThrown(new Error(message))).toBe(code);
  });

  it("treats puppeteer timeouts as network trouble", () => {
    const e = new Error("Navigation timeout of 30000 ms exceeded");
    e.name = "TimeoutError";
    expect(codeForThrown(e)).toBe("NETWORK");
  });

  it("keeps our own codes and rejects non-errors", () => {
    expect(codeForThrown(new CodedError("LOGIN_TIMEOUT"))).toBe("LOGIN_TIMEOUT");
    expect(codeForThrown("a string")).toBe("UNKNOWN");
    expect(codeForThrown(undefined)).toBe("UNKNOWN");
  });

  it("builds a fresh error that carries nothing from the original (fake password test)", () => {
    const original = new Error(`net::ERR_FAILED posting password=${FAKE_PASSWORD}`);
    (original as Error & { cause?: unknown }).cause = { password: FAKE_PASSWORD };
    const err = toCodedError(original);
    expect(err).toBeInstanceOf(CodedError);
    expect(err.code).toBe("NETWORK");
    expect(err.cause).toBeUndefined();
    expect(everythingVisible(err)).not.toContain(FAKE_PASSWORD);
  });
});
