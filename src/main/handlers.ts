// Connects each channel to the module that answers it. Ledger channels are
// live; sync channels and deleting gone rows wait for their modules.

import { CodedError } from "@shared/errors";
import type { Db } from "@core/db";
import {
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

export interface HandlerDeps {
  db: Db;
  version: string;
  dataDir: string;
  dev: boolean;
}

const notYet = (): never => {
  throw new CodedError("NOT_IMPLEMENTED");
};

export function createHandlers({ db, version, dataDir, dev }: HandlerDeps): Handlers {
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
    "transactions:deleteGone": notYet,
    "summary:month": ({ month }) => monthSummary(db, month),
    "summary:trend": ({ months }) => trend(db, months),
    "sync:start": notYet,
    "sync:cancel": notYet,
  };
}
