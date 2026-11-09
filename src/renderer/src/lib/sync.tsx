// Sync state for the whole window: which provider is syncing, its stage
// from `sync:progress`, whether the Sync panel and Add picker are open, the
// providers the user added, and toasts when a sync ends. One sync at a time.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { loadAddedProviders, type AddedStore } from "@/components/sync/added-providers";
import { IDLE, elapsedMs, formatElapsed, onClock, ticking, type ClockEvent, type SyncClock } from "@/components/sync/sync-clock";
import { ApiError, call, listen } from "./api";

interface SyncState {
  provider: ProviderId | null;
  stage: SyncStage | null;
  /** When the running sync started and stopped (spec 18). */
  clock: SyncClock;
  start: (provider: ProviderId) => void;
  cancel: () => void;
  /** The top bar's Sync panel, so a welcome screen can open it. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** The Add a bank or card picker. */
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  /** Providers the user added that may have no money accounts yet. */
  added: ProviderId[];
  addProvider: (provider: ProviderId) => void;
  removeProvider: (provider: ProviderId) => void;
}

// The added list lives in the database settings (spec 15). Ids only, never
// anything about the accounts themselves.
const addedStore: AddedStore = {
  get: () => call("settings:get", { key: "addedProviders" }),
  set: (list) => call("settings:set", { key: "addedProviders", value: list }).then(() => undefined),
};

function legacyStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function saveAdded(list: ProviderId[]): void {
  addedStore.set(list).catch(() => toast.error(s.errors.crashBody));
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [stage, setStage] = useState<SyncStage | null>(null);
  const [clock, setClock] = useState<SyncClock>(IDLE);
  const tick = useCallback((event: ClockEvent) => setClock((c) => onClock(c, event)), []);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState<ProviderId[]>([]);
  const active = useRef(false);

  useEffect(() => {
    let live = true;
    loadAddedProviders(addedStore, legacyStorage())
      .then((list) => live && setAdded((now) => [...new Set([...list, ...now])]))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(
    () =>
      listen("sync:progress", (p) => {
        if (!active.current) return;
        setStage(p.stage);
        tick({ type: "stage", stage: p.stage, at: Date.now() });
      }),
    [tick],
  );

  const start = useCallback(
    (id: ProviderId) => {
      if (active.current) return;
      active.current = true;
      setProvider(id);
      setStage("opening_browser");
      tick({ type: "start", at: Date.now() });
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
          tick({ type: "end" });
          // A sync can bring accounts, categories and rows: refresh it all.
          void client.invalidateQueries();
        });
    },
    [client, tick],
  );

  const cancel = useCallback(() => {
    tick({ type: "cancel", at: Date.now() });
    void call("sync:cancel", undefined).catch(() => undefined);
  }, [tick]);

  const addProvider = useCallback((id: ProviderId) => {
    setAdded((list) => {
      if (list.includes(id)) return list;
      const next = [...list, id];
      saveAdded(next);
      return next;
    });
  }, []);

  const removeProvider = useCallback((id: ProviderId) => {
    setAdded((list) => {
      const next = list.filter((p) => p !== id);
      saveAdded(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      provider,
      stage,
      clock,
      start,
      cancel,
      panelOpen,
      setPanelOpen,
      pickerOpen,
      setPickerOpen,
      added,
      addProvider,
      removeProvider,
    }),
    [provider, stage, clock, start, cancel, panelOpen, pickerOpen, added, addProvider, removeProvider],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync outside SyncProvider");
  return ctx;
}

/** "1:23" since the sync started, ticking each second until it stops; null when idle. */
export function useSyncElapsed(): string | null {
  const { clock } = useSync();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking(clock)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clock]);
  const ms = elapsedMs(clock, Math.max(now, clock.startedAt ?? 0));
  return ms === null ? null : formatElapsed(ms);
}
