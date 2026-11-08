// Sync state for the whole window: which provider is syncing, its stage
// from `sync:progress`, whether the Sync panel and Add picker are open, the
// providers the user added, and toasts when a sync ends. One sync at a time.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProviderId, SyncStage } from "@shared/types";
import { isEnabledProvider } from "@shared/providers";
import { s } from "@/strings";
import { ApiError, DEMO, call, listen } from "./api";

interface SyncState {
  provider: ProviderId | null;
  stage: SyncStage | null;
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

// No settings channel exists yet, so the added list lives in this window's
// localStorage. Ids only, never anything about the accounts themselves.
const ADDED_KEY = "coinleak.addedProviders";
// Demo: one provider added but never synced, to show that state.
const DEMO_ADDED: ProviderId[] = ["max"];

function readAdded(): ProviderId[] {
  try {
    const raw = localStorage.getItem(ADDED_KEY);
    if (raw == null) return DEMO ? DEMO_ADDED : [];
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isEnabledProvider) : [];
  } catch {
    return DEMO ? DEMO_ADDED : [];
  }
}

function saveAdded(list: ProviderId[]): void {
  try {
    localStorage.setItem(ADDED_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the list still holds for this session.
  }
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [stage, setStage] = useState<SyncStage | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState<ProviderId[]>(readAdded);
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
    [provider, stage, start, cancel, panelOpen, pickerOpen, added, addProvider, removeProvider],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync outside SyncProvider");
  return ctx;
}
