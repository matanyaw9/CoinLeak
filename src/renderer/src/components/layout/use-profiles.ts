// The profile list (spec 19), read by the sidebar switcher, the top bar's
// Sync button and Settings. Switching reloads the whole window from main,
// so nothing here needs to refresh other data.

import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@shared/types";
import { call } from "@/lib/api";

export const useProfiles = () =>
  useQuery({ queryKey: ["profiles:list"], queryFn: () => call("profiles:list", undefined) });

export function useCurrentProfile(): Profile | undefined {
  const list = useProfiles().data;
  return list?.profiles.find((p) => p.id === list.current);
}
