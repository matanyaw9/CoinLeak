// Connects each channel to the module that answers it. Thin by design:
// all logic lives in core (ledger), the sync service and the profile list.
// Every ledger call reads the open profile's database through `getDb()`.

import type { Db } from "@core/db";
import {
  categoryCurves,
  createCategory,
  deleteCategory,
  deleteGoneRows,
  emptyTrash,
  listAccounts,
  listCategories,
  listTransactions,
  monthFlow,
  monthSummary,
  restoreTransactions,
  setAccountsSyncing,
  setCardMode,
  setInternalByUser,
  trashTransactions,
  trend,
  updateCategory,
  updateTransactions,
} from "@core/ledger";
import { groupFlow, periodCurves, periodFlow, periodSummary, periodTrend, thisMonth } from "@core/ledger";
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
  currentProfile,
  databasePath,
  deleteProfile,
  DEMO_PROFILE,
  readProfiles,
  removeDatabaseFiles,
  renameProfile,
  setCurrentProfile,
} from "./profiles";
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
  now?: () => Date;
}

export function createHandlers(deps: HandlerDeps): Handlers {
  const { version, dataDir, dev, sync, getDb } = deps;
  return {
    ...profileHandlers(deps),
    "app:info": () => ({ version, dataDir, dev }),
    "accounts:list": () => listAccounts(getDb()),
    "accounts:setCardMode": ({ accountId, mode }) => {
      setCardMode(getDb(), accountId, mode);
      return null;
    },
    "categories:list": () => listCategories(getDb()),
    "transactions:list": (filter) => listTransactions(getDb(), filter ?? {}),
    "transactions:update": ({ ids, patch }) => updateTransactions(getDb(), ids, patch),
    "transactions:setInternal": ({ ids, internal }) => ({ updated: setInternalByUser(getDb(), ids, internal) }),
    "transactions:deleteGone": ({ ids }) => ({ deleted: deleteGoneRows(getDb(), ids) }),
    "transactions:trash": ({ ids }) => trashTransactions(getDb(), ids),
    "transactions:restore": ({ ids }) => restoreTransactions(getDb(), ids),
    "transactions:emptyTrash": () => emptyTrash(getDb()),
    "summary:month": ({ month }) => monthSummary(getDb(), month),
    "summary:trend": ({ months }) => trend(getDb(), months),
    "summary:curves": (args) => categoryCurves(getDb(), args),
    "summary:flow": ({ month }) => monthFlow(getDb(), month),
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
    "profiles:delete": ({ id }) => {
      deleteProfile(dataDir, id);
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
  };
}
