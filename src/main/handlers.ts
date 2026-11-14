// Connects each channel to the module that answers it. Thin by design:
// all logic lives in core (ledger), the sync service and the profile list.
// Every ledger call reads the open profile's database through `getDb()`.

import type { Db } from "@core/db";
import {
  createCategory,
  deleteCategory,
  deleteGoneRows,
  emptyTrash,
  listAccounts,
  listCategories,
  listTransactionsWithDays,
  restoreExclusions,
  restoreTransactions,
  setAccountsSyncing,
  setCardMode,
  setInternalByUser,
  trashTransactions,
  updateCategory,
  updateTransactions,
} from "@core/ledger";
import { groupFlow, periodCurves, periodFlow, periodSummary, periodTrend, thisMonth } from "@core/ledger";
import { addManualTransaction, editManualTransaction, getCashWallet } from "@core/ledger";
import { balanceChecks } from "@core/ledger";
import { budgetStatus, israelToday, setBudget } from "@core/ledger";
import {
  addKnownPlace,
  addStarters,
  applyAllRules,
  createRule,
  deleteRule,
  knownPlaces,
  listRules,
  previewRule,
  reorderRules,
  saveRule,
  starterPreview,
  suggestRule,
  updateRule,
} from "@core/rules";
import { getSetting, setSetting } from "@core/settings";
import { createDemoDatabase } from "@core/demo";
import { CodedError } from "@shared/errors";
import type { Channel } from "@shared/ipc";
import type { Handlers } from "./ipc";
import {
  addDemoProfile,
  addProfile,
  deleteAllData,
  currentProfile,
  databasePath,
  deleteProfile,
  DEMO_PROFILE,
  readProfiles,
  removeDatabaseFiles,
  renameProfile,
  setCurrentProfile,
} from "./profiles";
import { syncRanges } from "./sync-range";
import type { SyncService } from "./sync-service";

export interface HandlerDeps {
  version: string;
  dataDir: string;
  dev: boolean;
  sync: SyncService;
  /** The open profile's database. */
  getDb(): Db;
  /** Closes the open database and opens the current profile's from profiles.json. */
  openCurrentDb(): void;
  closeDb(): void;
  reloadWindow(): void;
  /** Clears what the window stored in Electron's own storage (local storage, caches). */
  clearWindowStorage(): Promise<void>;
  now?: () => Date;
}

export function createHandlers(deps: HandlerDeps): Handlers {
  const { version, dataDir, dev, sync, getDb } = deps;
  const now = deps.now ?? (() => new Date());
  return {
    ...profileHandlers(deps),
    "app:info": () => ({ version, dataDir, dev }),
    "accounts:list": () => listAccounts(getDb()),
    "accounts:setCardMode": ({ accountId, mode }) => {
      setCardMode(getDb(), accountId, mode);
      return null;
    },
    "categories:list": () => listCategories(getDb()),
    "transactions:list": (filter) => listTransactionsWithDays(getDb(), filter ?? {}),
    "transactions:update": ({ ids, patch }) => updateTransactions(getDb(), ids, patch),
    "transactions:restoreExclusions": ({ states }) => restoreExclusions(getDb(), states),
    "transactions:setInternal": ({ ids, internal }) => ({ updated: setInternalByUser(getDb(), ids, internal) }),
    "transactions:deleteGone": ({ ids }) => ({ deleted: deleteGoneRows(getDb(), ids) }),
    "transactions:trash": ({ ids }) => trashTransactions(getDb(), ids),
    "transactions:restore": ({ ids }) => restoreTransactions(getDb(), ids),
    "transactions:emptyTrash": () => emptyTrash(getDb()),
    "summary:period": (range) => periodSummary(getDb(), range),
    "summary:periodFlow": (range) => periodFlow(getDb(), range),
    "summary:groupFlow": (args) => groupFlow(getDb(), args),
    "summary:periodTrend": (args) => periodTrend(getDb(), args),
    "summary:periodCurves": (args) => periodCurves(getDb(), args),
    "summary:thisMonth": () => thisMonth(getDb()),
    "sync:start": ({ provider }) => {
      // The Demo profile holds made-up data and never talks to a bank.
      if (currentProfile(readProfiles(dataDir)).demo) throw new CodedError("BAD_REQUEST");
      return sync.start(provider);
    },
    "sync:cancel": () => {
      sync.cancel();
      return null;
    },
    "rules:list": () => listRules(getDb()),
    "rules:create": (rule) => createRule(getDb(), rule),
    "rules:update": ({ id, rule }) => updateRule(getDb(), id, rule),
    "rules:delete": ({ id }) => {
      deleteRule(getDb(), id);
      return null;
    },
    "rules:reorder": ({ ids }) => {
      reorderRules(getDb(), ids);
      return null;
    },
    "rules:preview": (rule) => previewRule(getDb(), rule),
    "rules:suggest": ({ ids }) => suggestRule(getDb(), ids),
    "categories:create": (input) => createCategory(getDb(), input),
    "categories:update": ({ id, patch }) => updateCategory(getDb(), id, patch),
    "categories:delete": ({ id, moveTo }) => deleteCategory(getDb(), id, moveTo),
    "budgets:status": ({ month }) => budgetStatus(getDb(), { month, today: israelToday(now()) }),
    "budgets:set": ({ categoryId, monthlyBudget }) => setBudget(getDb(), categoryId, monthlyBudget),
    "accounts:setSyncing": ({ ids, enabled }) => setAccountsSyncing(getDb(), ids, enabled),
    "settings:get": ({ key }) => getSetting(getDb(), key),
    "settings:set": (entry) => {
      setSetting(getDb(), entry);
      return null;
    },
    "rules:save": (args) => saveRule(getDb(), args),
    "rules:apply": () => applyAllRules(getDb()),
    "rules:knownPlaces": () => knownPlaces(getDb()),
    "rules:addKnownPlace": (args) => addKnownPlace(getDb(), args),
    "rules:starters": () => starterPreview(getDb()),
    "rules:addStarters": (args) => addStarters(getDb(), args),
    // spec 20
    "cash:wallet": () => getCashWallet(getDb()),
    "transactions:addManual": (input) => addManualTransaction(getDb(), input),
    "transactions:editManual": ({ id, input }) => editManualTransaction(getDb(), id, input),
    // spec 24
    "accounts:balanceChecks": () => balanceChecks(getDb()),
    // spec 23
    "sync:ranges": () => syncRanges(getSetting(getDb(), "syncFrom"), now()),
  };
}

type ProfileChannel = Extract<Channel, `profiles:${string}`>;

/** Profiles (spec 19): the list file, plus opening, closing and filling databases. */
function profileHandlers(deps: HandlerDeps): Pick<Handlers, ProfileChannel> {
  const { dataDir, sync, openCurrentDb, closeDb, reloadWindow } = deps;
  const now = deps.now ?? (() => new Date());
  return {
    "profiles:list": () => readProfiles(dataDir),
    "profiles:add": ({ name }) => addProfile(dataDir, name),
    "profiles:rename": ({ id, name }) => {
      renameProfile(dataDir, id, name);
      return null;
    },
    // spec 28: any profile. The open one closes first and the new current one opens after.
    "profiles:delete": ({ id }) => {
      const wasOpen = readProfiles(dataDir).current === id;
      if (!wasOpen) {
        deleteProfile(dataDir, id);
        return null;
      }
      if (sync.isRunning()) throw new CodedError("SYNC_IN_PROGRESS");
      closeDb();
      try {
        deleteProfile(dataDir, id);
      } finally {
        openCurrentDb();
      }
      reloadWindow();
      return null;
    },
    "profiles:switch": ({ id }) => {
      if (sync.isRunning()) throw new CodedError("SYNC_IN_PROGRESS");
      const before = readProfiles(dataDir).current;
      setCurrentProfile(dataDir, id);
      try {
        openCurrentDb();
      } catch {
        // The other file would not open: stay where we were.
        setCurrentProfile(dataDir, before);
        openCurrentDb();
        throw new CodedError("DATABASE");
      }
      reloadWindow();
      return null;
    },
    "profiles:addDemo": () => {
      if (readProfiles(dataDir).profiles.some((p) => p.demo)) throw new CodedError("BAD_REQUEST");
      const path = databasePath(dataDir, DEMO_PROFILE);
      removeDatabaseFiles(path);
      createDemoDatabase(path, now());
      return addDemoProfile(dataDir);
    },
    "profiles:resetDemo": () => {
      const list = readProfiles(dataDir);
      const demo = list.profiles.find((p) => p.demo);
      if (!demo) throw new CodedError("BAD_REQUEST");
      const isOpen = list.current === demo.id;
      if (isOpen) closeDb();
      const path = databasePath(dataDir, demo);
      removeDatabaseFiles(path);
      createDemoDatabase(path, now());
      if (isOpen) {
        openCurrentDb();
        reloadWindow();
      }
      return null;
    },
    // spec 23: delete for good. The database closes first, so no file is held open.
    "profiles:wipeCurrent": () => {
      if (sync.isRunning()) throw new CodedError("SYNC_IN_PROGRESS");
      const profile = currentProfile(readProfiles(dataDir));
      const path = databasePath(dataDir, profile);
      closeDb();
      try {
        removeDatabaseFiles(path);
        // The Demo profile starts again with fresh made-up data, like Reset demo data.
        if (profile.demo) createDemoDatabase(path, now());
      } catch {
        throw new CodedError("DATABASE");
      } finally {
        openCurrentDb();
      }
      reloadWindow();
      return null;
    },
    "profiles:wipeAll": async () => {
      if (sync.isRunning()) throw new CodedError("SYNC_IN_PROGRESS");
      closeDb();
      try {
        deleteAllData(dataDir);
        await deps.clearWindowStorage();
      } catch {
        throw new CodedError("DATABASE");
      } finally {
        // A fresh install: readProfiles makes the "Me" list, and its database opens empty.
        openCurrentDb();
      }
      reloadWindow();
      return null;
    },
  };
}
