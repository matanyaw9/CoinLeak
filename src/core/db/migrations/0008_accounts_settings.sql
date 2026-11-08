-- Money accounts the user removed from syncing (spec 15). A removed account
-- keeps every row, and its rows keep counting; it only leaves the Sync panel
-- until the user adds it back. 1 syncs, 0 does not.
--
-- The `settings` table (0001) now holds app settings the window used to keep
-- in its own storage, as JSON text under a fixed list of keys (core/settings.ts).

ALTER TABLE accounts ADD COLUMN sync_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sync_enabled IN (0, 1));
