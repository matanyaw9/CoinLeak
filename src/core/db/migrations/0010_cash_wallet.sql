-- Cash wallet and rows typed by hand (spec 20).
--
-- 1. Money accounts get a third kind, 'cash': one wallet per profile for
--    money that never touches a bank. It never syncs and has no provider
--    login. SQLite cannot change a CHECK in place, so `accounts` is rebuilt
--    with every row and id kept, the same way 0006 rebuilt categories.
--    Nothing points at accounts with an ON DELETE action, so no column has
--    to be saved aside: the dropped ids come back before the commit, which
--    settles the deferred foreign key checks again.
--
-- 2. `transactions.source` says where a row came from: 'sync' (a bank
--    download) or 'manual' (the user typed it in). Ingest never touches
--    manual rows; they live on the cash wallet only.

PRAGMA defer_foreign_keys = ON;

CREATE TEMP TABLE saved_accounts AS SELECT * FROM accounts;

DROP TABLE accounts;

CREATE TABLE accounts (
  id             INTEGER PRIMARY KEY,
  provider       TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('bank', 'card', 'cash')),
  account_number TEXT NOT NULL,
  name           TEXT,
  -- Cards always have a mode (credit: one bank line per cycle; debit: one
  -- bank line per purchase). Banks and the cash wallet never do.
  card_mode      TEXT CHECK (card_mode IN ('credit', 'debit')),
  balance        INTEGER,
  last_synced_at TEXT,
  created_at     TEXT NOT NULL,
  sync_enabled   INTEGER NOT NULL DEFAULT 1 CHECK (sync_enabled IN (0, 1)),
  UNIQUE (provider, account_number),
  CHECK ((kind = 'card') = (card_mode IS NOT NULL)),
  -- The cash wallet never syncs.
  CHECK (kind <> 'cash' OR sync_enabled = 0)
) STRICT;

INSERT INTO accounts (id, provider, kind, account_number, name, card_mode, balance, last_synced_at, created_at, sync_enabled)
SELECT id, provider, kind, account_number, name, card_mode, balance, last_synced_at, created_at, sync_enabled
FROM saved_accounts ORDER BY id;

DROP TABLE saved_accounts;

-- One cash wallet per profile.
CREATE UNIQUE INDEX accounts_one_cash_wallet ON accounts (kind) WHERE kind = 'cash';

ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'manual'));
