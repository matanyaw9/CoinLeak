-- Balance check (spec 24). Every balance a bank sends is kept, one per
-- account per sync run, so two of them can be compared with the rows booked
-- between them. `accounts.balance` still holds the latest, as before.
-- Money is integer agorot; `taken_at` is the sync's ISO UTC time.

CREATE TABLE balance_snapshots (
  id          INTEGER PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts (id),
  balance     INTEGER NOT NULL,
  taken_at    TEXT NOT NULL,
  sync_run_id INTEGER NOT NULL REFERENCES sync_runs (id),
  UNIQUE (account_id, sync_run_id)
) STRICT;

CREATE INDEX balance_snapshots_account ON balance_snapshots (account_id, taken_at);
