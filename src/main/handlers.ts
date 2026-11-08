// Connects each channel to the module that answers it. Thin by design:
// all logic lives in core (ledger) and the sync service.

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
import { createRule, deleteRule, listRules, previewRule, reorderRules, suggestRule, updateRule } from "@core/rules";
import { getSetting, setSetting } from "@core/settings";
import type { Handlers } from "./ipc";
import type { SyncService } from "./sync-service";

export interface HandlerDeps {
  db: Db;
  version: string;
  dataDir: string;
  dev: boolean;
  sync: SyncService;
}

export function createHandlers({ db, version, dataDir, dev, sync }: HandlerDeps): Handlers {
  return {
    "app:info": () => ({ version, dataDir, dev }),
    "accounts:list": () => listAccounts(db),
    "accounts:setCardMode": ({ accountId, mode }) => {
      setCardMode(db, accountId, mode);
      return null;
    },
    "categories:list": () => listCategories(db),
    "transactions:list": (filter) => listTransactions(db, filter ?? {}),
    "transactions:update": ({ ids, patch }) => updateTransactions(db, ids, patch),
    "transactions:setInternal": ({ ids, internal }) => ({ updated: setInternalByUser(db, ids, internal) }),
    "transactions:deleteGone": ({ ids }) => ({ deleted: deleteGoneRows(db, ids) }),
    "transactions:trash": ({ ids }) => trashTransactions(db, ids),
    "transactions:restore": ({ ids }) => restoreTransactions(db, ids),
    "transactions:emptyTrash": () => emptyTrash(db),
    "summary:month": ({ month }) => monthSummary(db, month),
    "summary:trend": ({ months }) => trend(db, months),
    "summary:curves": (args) => categoryCurves(db, args),
    "summary:flow": ({ month }) => monthFlow(db, month),
    "sync:start": ({ provider }) => sync.start(provider),
    "sync:cancel": () => {
      sync.cancel();
      return null;
    },
    "rules:list": () => listRules(db),
    "rules:create": (rule) => createRule(db, rule),
    "rules:update": ({ id, rule }) => updateRule(db, id, rule),
    "rules:delete": ({ id }) => {
      deleteRule(db, id);
      return null;
    },
    "rules:reorder": ({ ids }) => {
      reorderRules(db, ids);
      return null;
    },
    "rules:preview": (rule) => previewRule(db, rule),
    "rules:suggest": ({ ids }) => suggestRule(db, ids),
    "categories:create": (input) => createCategory(db, input),
    "categories:update": ({ id, patch }) => updateCategory(db, id, patch),
    "categories:delete": ({ id, moveTo }) => deleteCategory(db, id, moveTo),
    "accounts:setSyncing": ({ ids, enabled }) => setAccountsSyncing(db, ids, enabled),
    "settings:get": ({ key }) => getSetting(db, key),
    "settings:set": (entry) => {
      setSetting(db, entry);
      return null;
    },
  };
}
