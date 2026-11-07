// Sync state for the whole window: which provider is syncing, its stage
// from `sync:progress`, and toasts when it ends. One sync at a time.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { ApiError, call, listen } from "./api";
import { refreshLedger } from "./hooks";

interface SyncState {
  provider: ProviderId | null;
  stage: SyncStage | null;
  start: (provider: ProviderId) => void;
  cancel: () => void;
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [stage, setStage] = useState<SyncStage | null>(null);
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
          if (r.newRows > 0) toast.success(s.sync.added(name, r.newRows));
          else toast.success(s.sync.upToDate(name), r.updatedRows > 0 ? { description: s.sync.updated(r.updatedRows) } : {});
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.code === "LOGIN_CANCELLED") toast(e.message);
          else toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);
        })
        .finally(() => {
          active.current = false;
          setProvider(null);
          setStage(null);
          void refreshLedger(client);
        });
    },
    [client],
  );

  const cancel = useCallback(() => {
    void call("sync:cancel", undefined).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ provider, stage, start, cancel }), [provider, stage, start, cancel]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync outside SyncProvider");
  return ctx;
}
