// Known places (F29): per category, the business names in its list rule, from
// spec 13's `rules:knownPlaces` channel. The call lives in this one function:
// until that channel exists (or if its shape differs) the section shows nothing.

import { useQuery } from "@tanstack/react-query";
import { call } from "@/lib/api";

export interface KnownPlaces {
  categoryId: number;
  /** The list rule holding the names, so "Edit" can open it. */
  ruleId: number | null;
  names: string[];
}

const isId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

/** Keeps only well-formed entries, merging a category's lists in order. */
export function parseKnownPlaces(value: unknown): Map<number, KnownPlaces> {
  const out = new Map<number, KnownPlaces>();
  if (!Array.isArray(value)) return out;
  for (const item of value as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const { categoryId, ruleId, names } = item as Record<string, unknown>;
    if (!isId(categoryId) || !Array.isArray(names)) continue;
    const clean = names.filter((n): n is string => typeof n === "string" && n.trim() !== "");
    if (clean.length === 0) continue;
    const prev = out.get(categoryId);
    out.set(categoryId, {
      categoryId,
      ruleId: prev?.ruleId ?? (isId(ruleId) ? ruleId : null),
      names: [...new Set([...(prev?.names ?? []), ...clean])],
    });
  }
  return out;
}

// The channel is spec 13's and may not be in this build's contract yet, so
// it is called by name; any failure (unknown channel included) means "none".
type LooseCall = (channel: string, args: undefined) => Promise<unknown>;

export async function fetchKnownPlaces(): Promise<Map<number, KnownPlaces>> {
  try {
    return parseKnownPlaces(await (call as unknown as LooseCall)("rules:knownPlaces", undefined));
  } catch {
    return new Map();
  }
}

export const useKnownPlaces = () => useQuery({ queryKey: ["rules:knownPlaces"], queryFn: fetchKnownPlaces });
