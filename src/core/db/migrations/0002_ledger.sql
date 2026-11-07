-- Ledger schema: accounts, categories, sync runs and transactions (spec 02).
-- Seeded categories, colors and emoji from Spent (github.com/Shaya16/Spent),
-- src/server/db/migrations/ 010, 011, 014, 017, 018 and 022, as two levels.
--
-- Tables are STRICT, so a money column holding a float is an error, not a
-- silent conversion. Money is integer agorot; dates are `YYYY-MM-DD` text;
-- timestamps are ISO UTC text.

CREATE TABLE accounts (
  id             INTEGER PRIMARY KEY,
  provider       TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('bank', 'card')),
  account_number TEXT NOT NULL,
  name           TEXT,
  -- Cards always have a mode (credit: one bank line per cycle; debit: one
  -- bank line per purchase). Banks never do. The user can change it.
  card_mode      TEXT CHECK (card_mode IN ('credit', 'debit')),
  balance        INTEGER,
  last_synced_at TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (provider, account_number),
  CHECK ((kind = 'card') = (card_mode IS NOT NULL))
) STRICT;

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  parent_id  INTEGER REFERENCES categories (id),
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  emoji      TEXT,
  color      TEXT,
  archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (parent_id IS NULL OR parent_id <> id)
) STRICT;

CREATE UNIQUE INDEX categories_name ON categories (COALESCE(parent_id, 0), name);
CREATE INDEX categories_parent ON categories (parent_id);

-- Two levels only: a parent must be top level and share the child's kind,
-- and a category that has children cannot become a child.
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

CREATE TABLE sync_runs (
  id           INTEGER PRIMARY KEY,
  provider     TEXT NOT NULL,
  synced_at    TEXT NOT NULL,
  accounts     INTEGER NOT NULL DEFAULT 0,
  new_rows     INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE transactions (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts (id),
  date               TEXT NOT NULL,
  processed_date     TEXT,
  amount             INTEGER NOT NULL,
  original_amount    INTEGER,
  original_currency  TEXT,
  description        TEXT NOT NULL,
  memo               TEXT,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  installment_number INTEGER,
  installment_total  INTEGER,
  identifier         TEXT,

  -- User fields. Ingest never writes these after the first insert.
  category_id        INTEGER REFERENCES categories (id) ON DELETE SET NULL,
  category_source    TEXT CHECK (category_source IN ('user', 'rule')),
  note               TEXT,
  excluded           INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),

  -- Card-bill matching (ledger/card-bills.ts). `internal` drives the flow.
  -- When `internal_by_user` is 1 the user decided and the matcher keeps out.
  internal             INTEGER NOT NULL DEFAULT 0 CHECK (internal IN (0, 1)),
  internal_by_user     INTEGER NOT NULL DEFAULT 0 CHECK (internal_by_user IN (0, 1)),
  possible_card_bill   INTEGER NOT NULL DEFAULT 0 CHECK (possible_card_bill IN (0, 1)),
  card_bill_account_id INTEGER REFERENCES accounts (id),
  card_bill_style      TEXT CHECK (card_bill_style IN ('debit', 'credit')),
  -- debit style: the one card row this bank line paid
  card_bill_txn_id     INTEGER REFERENCES transactions (id),
  -- credit style: the cycle, i.e. the card rows with this processed date
  card_bill_date       TEXT,

  dedup_hash         TEXT NOT NULL,
  dedup_seq          INTEGER NOT NULL,
  sync_run_id        INTEGER REFERENCES sync_runs (id),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,

  UNIQUE (account_id, dedup_hash, dedup_seq),
  CHECK ((installment_number IS NULL) = (installment_total IS NULL))
) STRICT;

CREATE INDEX transactions_date ON transactions (date);
CREATE INDEX transactions_account_date ON transactions (account_id, date);
CREATE INDEX transactions_account_processed ON transactions (account_id, processed_date);
CREATE INDEX transactions_category ON transactions (category_id);
CREATE INDEX transactions_sync_run ON transactions (sync_run_id);

-- ---- Seeded categories ----

INSERT INTO categories (name, kind, emoji, color, sort_order) VALUES
  ('Food',            'expense', '🍔', '#E7A875', 1),
  ('Transportation',  'expense', '🚗', '#7D90CA', 2),
  ('Lifestyle',       'expense', '✨', '#D692BF', 3),
  ('Home & Bills',    'expense', '🏠', '#A4C386', 4),
  ('Health & Family', 'expense', '🩷', '#65C1D1', 5),
  ('Money Movement',  'expense', '🔄', '#A2ABBB', 6),
  ('Salary',                   'income', '💼', '#85B59A', 101),
  ('Freelance & Side Income',  'income', '🧑‍💻', '#C0D582', 102),
  ('Investment Income',        'income', '📈', '#7B85C9', 103),
  ('Refunds & Reimbursements', 'income', '💵', '#7DC8B3', 104);

INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color, c.sort_order
FROM (
            SELECT 'Food' AS parent, 'Groceries' AS name, '🛒' AS emoji, '#81B482' AS color, 1 AS sort_order
  UNION ALL SELECT 'Food', 'Restaurants', '🍽️', '#E89B80', 2
  UNION ALL SELECT 'Food', 'Coffee & Cafes', '☕', '#A57B5B', 3
  UNION ALL SELECT 'Transportation', 'Transport', '🚌', '#65AFD2', 1
  UNION ALL SELECT 'Transportation', 'Travel', '✈️', '#64B8D2', 2
  UNION ALL SELECT 'Lifestyle', 'Shopping', '🛍️', '#DCB87A', 1
  UNION ALL SELECT 'Lifestyle', 'Entertainment', '🎬', '#E499A4', 2
  UNION ALL SELECT 'Lifestyle', 'Personal Care', '💇', '#D5A4D7', 3
  UNION ALL SELECT 'Lifestyle', 'Sports & Hobbies', '⚽', '#7BB36B', 4
  UNION ALL SELECT 'Home & Bills', 'Bills & Utilities', '🧾', '#B8A98F', 1
  UNION ALL SELECT 'Home & Bills', 'Home', '🛋️', '#D3A96F', 2
  UNION ALL SELECT 'Home & Bills', 'Insurance', '🛡️', '#E59A99', 3
  UNION ALL SELECT 'Home & Bills', 'Subscriptions', '🔁', '#AB9DDB', 4
  UNION ALL SELECT 'Health & Family', 'Health', '🩺', '#75BCA3', 1
  UNION ALL SELECT 'Health & Family', 'Education', '🎓', '#94A0DD', 2
  UNION ALL SELECT 'Health & Family', 'Kids & Childcare', '👶', '#E5D080', 3
  UNION ALL SELECT 'Health & Family', 'Pet Care', '🐾', '#6EBFB5', 4
  UNION ALL SELECT 'Money Movement', 'Cash & ATM', '🏧', '#DBC27F', 1
  UNION ALL SELECT 'Money Movement', 'Transfers', '💸', '#A2AAC2', 2
  UNION ALL SELECT 'Money Movement', 'Gifts & Donations', '🎁', '#D67BAA', 3
  UNION ALL SELECT 'Money Movement', 'Fees & Taxes', '🏛️', '#C29B6F', 4
) AS c
JOIN categories p ON p.name = c.parent AND p.parent_id IS NULL;
