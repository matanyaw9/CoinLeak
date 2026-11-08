-- Transfers and trash tombstones (spec 14).
--
-- 1. Categories get a third kind, 'transfer': money moved to savings or
--    investments, which counts as neither spending nor income. SQLite cannot
--    change a CHECK in place, so the table is rebuilt with every id kept.
--
--    Migrations run inside one transaction with foreign keys on, where
--    `PRAGMA foreign_keys` cannot change. So the old table is copied aside
--    and dropped with foreign key checks deferred to commit, then recreated
--    under the same name with the same ids, which settles the checks again.
--    Dropping runs ON DELETE SET NULL on `transactions.category_id`, so each
--    row's category (and only that column) is saved first and put back.
--
-- 2. Emptying the Trash deletes rows for good. Their dedup keys stay behind
--    as tombstones so a later download never adds them again.

PRAGMA defer_foreign_keys = ON;

CREATE TEMP TABLE saved_categories AS SELECT * FROM categories;
CREATE TEMP TABLE saved_txn_categories AS
  SELECT id, category_id FROM transactions WHERE category_id IS NOT NULL;

DROP TABLE categories;

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  parent_id  INTEGER REFERENCES categories (id),
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
  emoji      TEXT,
  color      TEXT,
  archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (parent_id IS NULL OR parent_id <> id)
) STRICT;

-- Parents first, so the self reference holds row by row.
INSERT INTO categories (id, parent_id, name, kind, emoji, color, archived, sort_order)
SELECT id, parent_id, name, kind, emoji, color, archived, sort_order FROM saved_categories
ORDER BY parent_id IS NOT NULL, id;

UPDATE transactions
SET category_id = (SELECT s.category_id FROM saved_txn_categories s WHERE s.id = transactions.id)
WHERE id IN (SELECT id FROM saved_txn_categories);

DROP TABLE saved_categories;
DROP TABLE saved_txn_categories;

CREATE UNIQUE INDEX categories_name ON categories (COALESCE(parent_id, 0), name);
CREATE INDEX categories_parent ON categories (parent_id);

CREATE TRIGGER categories_two_levels_insert
BEFORE INSERT ON categories
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'category parent must be a top-level category of the same kind')
  WHERE NOT EXISTS (
    SELECT 1 FROM categories p
    WHERE p.id = NEW.parent_id AND p.parent_id IS NULL AND p.kind = NEW.kind
  );
END;

CREATE TRIGGER categories_two_levels_update
BEFORE UPDATE OF parent_id, kind ON categories
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'category parent must be a top-level category of the same kind')
  WHERE NOT EXISTS (
    SELECT 1 FROM categories p
    WHERE p.id = NEW.parent_id AND p.parent_id IS NULL AND p.kind = NEW.kind
  );
  SELECT RAISE(ABORT, 'a category with children cannot become a child')
  WHERE EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id);
END;

INSERT INTO categories (name, kind, emoji, color, sort_order)
VALUES ('Savings & Investments', 'transfer', '🏦', '#8FB8C9', 51);

INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order)
SELECT p.id, c.name, 'transfer', c.emoji, c.color, c.sort_order
FROM (
            SELECT 'Savings' AS name, '🐷' AS emoji, '#86BFA8' AS color, 1 AS sort_order
  UNION ALL SELECT 'Investments', '📊', '#8E9BD0', 2
) AS c
JOIN categories p ON p.name = 'Savings & Investments' AND p.parent_id IS NULL;

CREATE TABLE trash_tombstones (
  account_id INTEGER NOT NULL REFERENCES accounts (id),
  dedup_hash TEXT NOT NULL,
  dedup_seq  INTEGER NOT NULL,
  emptied_at TEXT NOT NULL,
  PRIMARY KEY (account_id, dedup_hash, dedup_seq)
) STRICT;
