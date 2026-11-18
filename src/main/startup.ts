// Startup must never leave CoinLeak running with no window. A data file that
// will not open still lets the window open: every screen then shows the fixed
// DATABASE message, and Settings can still delete everything.

import { toAppError } from "@shared/errors";

/** Opens the database, or logs only the error code and carries on without one. */
export function openAtStartup(open: () => void, log: (line: string) => void = console.error): void {
  try {
    open();
  } catch (e) {
    log(`[db] could not open the data file: ${toAppError(e).code}`);
  }
}
