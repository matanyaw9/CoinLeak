// Sync state for the whole window: which provider is syncing, its stage
// from `sync:progress`, whether the Sync panel is open, and toasts when it
// ends. One sync at a time.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { ApiError, call, listen } from "./api";

interface SyncState {
  provider: ProviderId | null;
  stage: SyncStage | null;
  start: (provider: ProviderId) => void;
  cancel: () => void;
  /** The top bar's Sync panel, so a welcome screen can open it. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [stage, setStage] = useState<SyncStage | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const active = useRef(false);

  useEffect(
    () =>
      listen("sync:progress", (p) => {
        if (active.current) setStage(p.stage);
      }),
    [],
  );

  const start = useCallback(
    (id: ProviderId) => {
      if (active.current) return;
      active.current = true;
      setProvider(id);
      setStage("opening_browser");
      const name = s.providers[id].short;
      call("sync:start", { provider: id })
        .then((r) => {
          const more = r.updatedRows > 0 ? { description: s.sync.updated(r.updatedRows) } : {};
          if (r.newRows > 0) toast.success(s.sync.added(name, r.newRows), more);
          else toast.success(s.sync.upToDate(name), more);
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.code === "LOGIN_CANCELLED") toast(e.message);
          else toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);
        })
        .finally(() => {
          active.current = false;
          setProvider(null);
          setStage(null);
          // A sync can bring accounts, categories and rows: refresh it all.
          void client.invalidateQueries();
        });
    },
    [client],
  );

  const cancel = useCallback(() => {
    void call("sync:cancel", undefined).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ provider, stage, start, cancel, panelOpen, setPanelOpen }),
    [provider, stage, start, cancel, panelOpen],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync outside SyncProvider");
  return ctx;
}
