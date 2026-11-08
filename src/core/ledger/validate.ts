// Input checks for ledger functions the window can reach. Anything malformed
// is BAD_REQUEST, never a database error with SQL text in it.

import { CodedError } from "@shared/errors";
import type { Flow } from "@shared/types";
import { isIsoDate } from "./dates";

export const FLOWS: readonly Flow[] = ["spending", "income", "refund", "internal", "excluded", "gone", "trashed", "transfer"];

export function check(condition: boolean): asserts condition {
  if (!condition) throw new CodedError("BAD_REQUEST");
}

export function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function assertIds(ids: unknown): asserts ids is number[] {
  check(Array.isArray(ids) && ids.every(isId));
}

export function assertOptionalDate(value: unknown): void {
  check(value === undefined || isIsoDate(value));
}
