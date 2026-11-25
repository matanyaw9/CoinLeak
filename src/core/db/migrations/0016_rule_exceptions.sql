-- Rule exceptions (spec 35, F71): rows the user unticked in a rule's editor.
-- That rule never matches them again, also after later edits of the rule;
-- other rules still do. Deleting the rule or the row deletes the pair.

CREATE TABLE rule_exceptions (
  rule_id        INTEGER NOT NULL REFERENCES rules (id) ON DELETE CASCADE,
  transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, transaction_id)
) STRICT;

-- Deleting a row finds its exceptions without reading the whole table.
CREATE INDEX rule_exceptions_transaction ON rule_exceptions (transaction_id);
