// Screenshot aid: `?shot=...` in the route asks a page to open a dialog,
// select rows or show a toast, so headless screenshots can show states a
// click would reach. Only a dev start route (COINLEAK_START_ROUTE) can set
// it; the app itself never puts `shot` in a link.

import { useSearchParams } from "react-router";

export function useShot(): string | null {
  const [params] = useSearchParams();
  return params.get("shot");
}

/**
 * A start-route parameter read from the hash itself, for parts that also
 * render outside the router: the rule editor and the category picker in it.
 * A router hook there crashes the window.
 */
export function hashParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const query = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(query).get(name);
}
