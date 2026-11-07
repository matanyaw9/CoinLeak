-- Rules (spec 07): ordered conditions (text on description or memo, optional
-- account, amount range on the absolute amount, direction) with actions (set
-- category, set excluded). For each action the first enabled matching rule
-- wins. A field the user set is never changed by a rule.
--
-- `transactions.rule_id` is the last rule, in order, whose action the engine
-- applied to the row (NULL when no field is the rules'). `excluded_source`
-- says who set `excluded`: 'user' or 'rule'; NULL while nobody did.

CREATE TABLE rules (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- Order of evaluation, 1 first.
  position        INTEGER NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  match_field     TEXT NOT NULL CHECK (match_field IN ('description', 'memo')),
  match_mode      TEXT NOT NULL CHECK (match_mode IN ('contains', 'starts_with', 'equals', 'regex')),
  match_text      TEXT NOT NULL CHECK (length(match_text) BETWEEN 1 AND 200),
  account_id      INTEGER REFERENCES accounts (id),
  amount_min      INTEGER CHECK (amount_min >= 0),
  amount_max      INTEGER CHECK (amount_max >= 0),
  direction       TEXT CHECK (direction IN ('out', 'in')),
  set_category_id INTEGER REFERENCES categories (id),
  set_excluded    INTEGER CHECK (set_excluded IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  CHECK (amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max),
  CHECK (set_category_id IS NOT NULL OR set_excluded IS NOT NULL)
) STRICT;

CREATE INDEX rules_position ON rules (position);

ALTER TABLE transactions ADD COLUMN rule_id INTEGER REFERENCES rules (id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN excluded_source TEXT CHECK (excluded_source IN ('user', 'rule'));

CREATE INDEX transactions_rule ON transactions (rule_id);

-- Every exclusion made before rules existed was the user's.
UPDATE transactions SET excluded_source = 'user' WHERE excluded = 1;
