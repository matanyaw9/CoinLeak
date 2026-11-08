-- Rules v2 (spec 13): a rule holds a list of conditions joined by all (AND)
-- or any (OR). A text condition holds one or more values and fits when any
-- of them does ("description contains Aroma, Cofix or Landwer").
--
-- Every existing rule becomes the same rule with join 'all' and one
-- condition per part it had: its text, then account, direction and amount.
-- That is exactly the old meaning, so every rule matches the same rows.
--
-- The rules table is rebuilt to drop its single-condition columns. Dropping
-- it sets transactions.rule_id to NULL (ON DELETE SET NULL, and foreign keys
-- cannot be switched off inside the migration's transaction), so the links
-- are kept aside first and written back after.

CREATE TABLE rule_links_0007 AS SELECT id AS txn_id, rule_id FROM transactions WHERE rule_id IS NOT NULL;
CREATE TABLE rules_0007 AS SELECT * FROM rules;

DROP INDEX rules_position;
DROP TABLE rules;

CREATE TABLE rules (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- Order of evaluation, 1 first.
  position        INTEGER NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  -- 'all': every condition must hold. 'any': at least one.
  join_mode       TEXT NOT NULL DEFAULT 'all' CHECK (join_mode IN ('all', 'any')),
  set_category_id INTEGER REFERENCES categories (id),
  set_excluded    INTEGER CHECK (set_excluded IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  CHECK (set_category_id IS NOT NULL OR set_excluded IS NOT NULL)
) STRICT;

CREATE INDEX rules_position ON rules (position);

-- One row per condition. Only the columns of its kind are set.
CREATE TABLE rule_conditions (
  id           INTEGER PRIMARY KEY,
  rule_id      INTEGER NOT NULL REFERENCES rules (id) ON DELETE CASCADE,
  -- Order shown in the editor and the sentence, 1 first.
  position     INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('text', 'account', 'amount', 'direction')),
  match_field  TEXT CHECK (match_field IN ('description', 'memo')),
  match_mode   TEXT CHECK (match_mode IN ('contains', 'starts_with', 'equals', 'regex')),
  -- JSON array of one or more strings.
  match_values TEXT CHECK (match_values IS NULL OR (json_valid(match_values) AND json_array_length(match_values) > 0)),
  account_id   INTEGER REFERENCES accounts (id),
  amount_min   INTEGER CHECK (amount_min >= 0),
  amount_max   INTEGER CHECK (amount_max >= 0),
  direction    TEXT CHECK (direction IN ('out', 'in')),
  CHECK (amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max),
  CHECK (kind <> 'text' OR (match_field IS NOT NULL AND match_mode IS NOT NULL AND match_values IS NOT NULL)),
  CHECK (kind <> 'account' OR account_id IS NOT NULL),
  CHECK (kind <> 'amount' OR amount_min IS NOT NULL OR amount_max IS NOT NULL),
  CHECK (kind <> 'direction' OR direction IS NOT NULL)
) STRICT;

CREATE INDEX rule_conditions_rule ON rule_conditions (rule_id, position);

INSERT INTO rules (id, name, position, enabled, join_mode, set_category_id, set_excluded, created_at, updated_at)
SELECT id, name, position, enabled, 'all', set_category_id, set_excluded, created_at, updated_at FROM rules_0007;

INSERT INTO rule_conditions (rule_id, position, kind, match_field, match_mode, match_values)
SELECT id, 1, 'text', match_field, match_mode, json_array(match_text) FROM rules_0007;

INSERT INTO rule_conditions (rule_id, position, kind, account_id)
SELECT id, 2, 'account', account_id FROM rules_0007 WHERE account_id IS NOT NULL;

INSERT INTO rule_conditions (rule_id, position, kind, direction)
SELECT id, 3, 'direction', direction FROM rules_0007 WHERE direction IS NOT NULL;

INSERT INTO rule_conditions (rule_id, position, kind, amount_min, amount_max)
SELECT id, 4, 'amount', amount_min, amount_max FROM rules_0007 WHERE amount_min IS NOT NULL OR amount_max IS NOT NULL;

UPDATE transactions SET rule_id = (SELECT l.rule_id FROM rule_links_0007 l WHERE l.txn_id = transactions.id)
WHERE id IN (SELECT txn_id FROM rule_links_0007);

DROP TABLE rule_links_0007;
DROP TABLE rules_0007;
