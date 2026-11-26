-- New profiles start with two levels of categories (F94): the level 3
-- defaults 0015 added (Weekly shop, Top-up, Specialty food, Bus, Train) go.
--
-- Only on a profile just made: no transactions (trashed ones count) and no
-- rules. Only a category still as 0015 made it: its name in its place, no
-- budget, nothing under it. Existing and restored profiles keep theirs.

WITH defaults (grandparent, parent, name) AS (
  VALUES
    ('Groceries & Shop', 'Groceries', 'Weekly shop'),
    ('Groceries & Shop', 'Groceries', 'Top-up'),
    ('Groceries & Shop', 'Groceries', 'Specialty food'),
    ('Transportation', 'Transport', 'Bus'),
    ('Transportation', 'Transport', 'Train')
)
DELETE FROM categories
WHERE NOT EXISTS (SELECT 1 FROM transactions)
  AND NOT EXISTS (SELECT 1 FROM rules)
  AND monthly_budget IS NULL
  AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = categories.id)
  AND id IN (
    SELECT x.id FROM defaults d
    JOIN categories g ON g.name = d.grandparent COLLATE NOCASE AND g.parent_id IS NULL AND g.kind = 'expense'
    JOIN categories p ON p.name = d.parent COLLATE NOCASE AND p.parent_id = g.id AND p.kind = 'expense'
    JOIN categories x ON x.name = d.name COLLATE NOCASE AND x.parent_id = p.id AND x.kind = 'expense'
  );
