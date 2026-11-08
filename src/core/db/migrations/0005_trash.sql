-- Trash (spec 11). The user can move a row to Trash: it counts nowhere and
-- leaves every list but the Trash page, until restored. The row stays in
-- the table so a later sync knows it and never adds it again.
--
-- `trashed_at` is when the user trashed it (ISO UTC); NULL while not
-- trashed. A user field: sync, rules and card-bill matching never write it.

ALTER TABLE transactions ADD COLUMN trashed_at TEXT;

CREATE INDEX transactions_trashed ON transactions (trashed_at) WHERE trashed_at IS NOT NULL;
