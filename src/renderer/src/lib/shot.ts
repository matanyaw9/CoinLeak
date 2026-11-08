// Demo screenshot aid: `?shot=...` in the route asks a page to open a
// dialog, select rows or show a toast, so headless screenshots can show
// states a click would reach. Always null outside demo builds.

import { useSearchParams } from "react-router";
import { DEMO } from "./api";

export function useShot(): string | null {
  const [params] = useSearchParams();
  return DEMO ? params.get("shot") : null;
}
