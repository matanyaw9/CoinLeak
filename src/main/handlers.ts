// Connects each channel to the module that answers it. Thin by design:
// all logic lives in core (ledger) and the sync service.

import type { Db } from "@core/db";
import {
  deleteGoneRows,
  listAccounts,
  listCategories,
  listTransactions,
  monthSummary,
  setCardMode,
  setInternalByUser,
  trend,
  updateTransactions,
} from "@core/ledger";
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
    "summary:month": ({ month }) => monthSummary(db, month),
    "summary:trend": ({ months }) => trend(db, months),
    "sync:start": ({ provider }) => sync.start(provider),
    "sync:cancel": () => {
      sync.cancel();
      return null;
    },
  };
}
