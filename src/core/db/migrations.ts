// Ordered schema changes. Never edit a migration that has shipped; add the
// next number instead. Each module's spec says which numbers it owns.

import m0001 from "./migrations/0001_init.sql?raw";
import m0002 from "./migrations/0002_ledger.sql?raw";

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, sql: m0001 },
  { version: 2, sql: m0002 },
];
