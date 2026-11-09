// Home's All / Essentials / Extras choice (spec 22), remembered per profile
// in the `homeSpendingFilter` setting (spec 25). Core does the filtering:
// this only keeps the choice and turns it into the channels' `essential` arg.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeSpendingFilter } from "@shared/types";
import { call } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";

export type SpendingFilter = HomeSpendingFilter;

const KEY = queryKey("settings:get", { key: "homeSpendingFilter" });

/** `initial` (demo screenshots) wins over the saved choice and is not saved. */
export function useSpendingFilter(initial?: SpendingFilter): [SpendingFilter, (f: SpendingFilter) => void] {
  const client = useQueryClient();
  const [picked, setPicked] = useState<SpendingFilter | undefined>(initial);
  const saved = useQuery({
    queryKey: KEY,
    queryFn: async () => (await call("settings:get", { key: "homeSpendingFilter" })) as SpendingFilter,
    staleTime: Infinity,
  });
  const set = (f: SpendingFilter) => {
    setPicked(f);
    client.setQueryData(KEY, f);
    // Remembering is a convenience: if saving fails, the choice still shows now.
    call("settings:set", { key: "homeSpendingFilter", value: f }).catch(() => undefined);
  };
  return [picked ?? saved.data ?? "all", set];
}

/** The `essential` arg for the period channels: left out under All. */
export function essentialArg(filter: SpendingFilter): { essential?: boolean } {
  return filter === "all" ? {} : { essential: filter === "essential" };
}
