// Ordered schema changes. Never edit a migration that has shipped; add the
// next number instead. Each module's spec says which numbers it owns.

import m0001 from "./migrations/0001_init.sql?raw";
import m0002 from "./migrations/0002_ledger.sql?raw";
import m0003 from "./migrations/0003_pending.sql?raw";
import m0004 from "./migrations/0004_rules.sql?raw";
import m0005 from "./migrations/0005_trash.sql?raw";
import m0006 from "./migrations/0006_transfers.sql?raw";
import m0007 from "./migrations/0007_rule_conditions.sql?raw";
import m0008 from "./migrations/0008_accounts_settings.sql?raw";
import m0009 from "./migrations/0009_essential_categories.sql?raw";
import m0010 from "./migrations/0010_cash_wallet.sql?raw";
import m0011 from "./migrations/0011_balance_snapshots.sql?raw";
import m0012 from "./migrations/0012_budgets.sql?raw";
import m0013 from "./migrations/0013_routine_treat_categories.sql?raw";
import m0014 from "./migrations/0014_paid_back.sql?raw";
import m0016 from "./migrations/0016_rule_exceptions.sql?raw";

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, sql: m0001 },
  { version: 2, sql: m0002 },
  { version: 3, sql: m0003 },
  { version: 4, sql: m0004 },
  { version: 5, sql: m0005 },
  { version: 6, sql: m0006 },
  { version: 7, sql: m0007 },
  { version: 8, sql: m0008 },
  { version: 9, sql: m0009 },
  { version: 10, sql: m0010 },
  { version: 11, sql: m0011 },
  { version: 12, sql: m0012 },
  { version: 13, sql: m0013 },
  { version: 14, sql: m0014 },
  { version: 16, sql: m0016 },
];
