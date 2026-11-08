// Known places (F29): per category, the business names in its list rules,
// from spec 13's `rules:knownPlaces` channel, keyed by category for the page.

import { useQuery } from "@tanstack/react-query";
import type { KnownPlaces as ChannelPlaces } from "@shared/types";
import { call } from "@/lib/api";

export interface KnownPlaces {
  categoryId: number;
  /** The first list rule holding the names, so "Edit" can open it. */
  ruleId: number | null;
  names: string[];
}

export function byCategory(list: ChannelPlaces[]): Map<number, KnownPlaces> {
  const out = new Map<number, KnownPlaces>();
  for (const { categoryId, names, ruleIds } of list) {
    if (names.length > 0) out.set(categoryId, { categoryId, ruleId: ruleIds[0] ?? null, names });
  }
  return out;
}

export const useKnownPlaces = () =>
  useQuery({ queryKey: ["rules:knownPlaces"], queryFn: async () => byCategory(await call("rules:knownPlaces", undefined)) });
