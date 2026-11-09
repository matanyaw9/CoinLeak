// Home's All / Essentials / Extras choice (spec 22). Kept in memory for the
// window's life; switching profile reloads the window, so each profile
// starts at All. Core does the filtering: this only turns the choice into
// the channels' optional `essential` arg.

import { useState } from "react";

export type SpendingFilter = "all" | "essential" | "extra";

let remembered: SpendingFilter = "all";

export function useSpendingFilter(initial?: SpendingFilter): [SpendingFilter, (f: SpendingFilter) => void] {
  const [filter, setFilter] = useState<SpendingFilter>(initial ?? remembered);
  const set = (f: SpendingFilter) => {
    remembered = f;
    setFilter(f);
  };
  return [filter, set];
}

/** The `essential` arg for the period channels: left out under All. */
export function essentialArg(filter: SpendingFilter): { essential?: boolean } {
  return filter === "all" ? {} : { essential: filter === "essential" };
}
