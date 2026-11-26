// Restore, choose what to keep (spec 41 B, F93): takes out of a just restored
// database what the user did not bring over. Never run on a profile in use.
// Categories always stay.

import type { RestoreCounts, RestoreKeep } from "@shared/types";
import { transaction, type Db } from "./index";

/**
 * Removes what was not kept, all or nothing, then rebuilds the file so no
 * removed value stays in it. Answers with what is left of each kept part.
 */
export function trimRestored(db: Db, keep: RestoreKeep): RestoreCounts {
  transaction(db, () => {
    // Rules first: they point at accounts.
    if (!keep.rules) dropRules(db);
    if (!keep.transactions) dropTransactions(db);
    if (!keep.budgets) dropBudgets(db);
  });
  // VACUUM rewrites the database; the checkpoint moves that into the file and empties the -wal.
  db.exec("VACUUM; PRAGMA wal_checkpoint(TRUNCATE)");
  return {
    transactions: keep.transactions ? count(db, "SELECT COUNT(*) AS n FROM transactions WHERE trashed_at IS NULL") : null,
    rules: keep.rules ? count(db, "SELECT COUNT(*) AS n FROM rules") : null,
    budgets: keep.budgets,
  };
}

/** What a rule had sorted or ignored stays so, as the user's: a later rule run would clear it otherwise. */
function dropRules(db: Db): void {
  db.exec(`
    UPDATE transactions SET category_source = 'user' WHERE category_source = 'rule';
    UPDATE transactions SET excluded_source = 'user' WHERE excluded_source = 'rule';
    UPDATE transactions SET rule_id = NULL;
    -- Conditions and exceptions go with their rule.
    DELETE FROM rules;
  `);
}

/**
 * Every row, balance, sync run and Trash tombstone, and the accounts. Two
 * kinds of account stay, emptied: the cash wallet, and one a kept rule is
 * limited to, so that rule keeps its meaning.
 */
function dropTransactions(db: Db): void {
  db.exec(`
    DELETE FROM rule_exceptions;
    DELETE FROM balance_snapshots;
    DELETE FROM trash_tombstones;
    DELETE FROM transactions;
    DELETE FROM sync_runs;
    DELETE FROM accounts
      WHERE kind <> 'cash' AND id NOT IN (SELECT account_id FROM rule_conditions WHERE account_id IS NOT NULL);
    UPDATE accounts SET balance = NULL, last_synced_at = NULL;
  `);
}

function dropBudgets(db: Db): void {
  db.exec(`
    UPDATE categories SET monthly_budget = NULL;
    DELETE FROM settings WHERE key = 'budgetTotal';
  `);
}

function count(db: Db, sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}
