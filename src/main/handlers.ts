// Connects each channel to the module that answers it. Wave 1 answers only
// app:info; the rest are wired once the ledger and sync modules land.

import { CodedError } from "@shared/errors";
import type { Db } from "@core/db";
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

export function createHandlers(deps: HandlerDeps): Handlers {
  return {
    "app:info": () => ({ version: deps.version, dataDir: deps.dataDir, dev: deps.dev }),
    "accounts:list": notYet,
    "categories:list": notYet,
    "transactions:list": notYet,
    "transactions:update": notYet,
    "summary:month": notYet,
    "summary:trend": notYet,
    "sync:start": notYet,
    "sync:cancel": notYet,
  };
}
