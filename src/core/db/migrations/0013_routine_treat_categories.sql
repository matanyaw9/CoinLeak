-- New default categories: routine spending apart from treats (spec 28).
--
-- Only rows that still look like the defaults change, the same spirit as
-- 0009. A category is matched by its name (any case) and the name of its
-- default group; one the user renamed, moved or deleted is left alone. A
-- move keeps the category's id, so its rows, rules and budgets stay with
-- it, and no row changes category. A new name that already exists under its
-- target group is skipped. Only the columns of 0009 are used, so this runs
-- the same before or after 0012.

-- 1. New groups, unless a group of that name is already there.
INSERT INTO categories (name, kind, emoji, color, sort_order)
SELECT g.name, 'expense', g.emoji, g.color, g.sort_order
FROM (
            SELECT 'Groceries & Shop' AS name, '🧺' AS emoji, '#8DBF7F' AS color, 1 AS sort_order
  UNION ALL SELECT 'Shopping', '🛍️', '#DCB87A', 3
  UNION ALL SELECT 'Work', '🧰', '#8FA6B8', 8
) AS g
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id IS NULL AND x.name = g.name COLLATE NOCASE
);

-- 2. Default groups take their place in the new order, if they still have
--    their default name and place.
UPDATE categories SET sort_order = CASE name
    WHEN 'Food' THEN 2
    WHEN 'Transportation' THEN 4
    WHEN 'Lifestyle' THEN 5
    WHEN 'Home & Bills' THEN 6
    WHEN 'Health & Family' THEN 7
    WHEN 'Money Movement' THEN 9
  END
WHERE parent_id IS NULL AND kind = 'expense' AND (
     (name = 'Food' AND sort_order = 1)
  OR (name = 'Transportation' AND sort_order = 2)
  OR (name = 'Lifestyle' AND sort_order = 3)
  OR (name = 'Home & Bills' AND sort_order = 4)
  OR (name = 'Health & Family' AND sort_order = 5)
  OR (name = 'Money Movement' AND sort_order = 6)
);

-- 3. Moves. Groceries leaves Food for Groceries & Shop. Lifestyle's
--    Shopping becomes "Other shopping" in the Shopping group, after the two
--    new shopping categories, and gets its own emoji if it still has the
--    group's.
UPDATE categories SET
  parent_id = (SELECT g.id FROM categories g WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Groceries & Shop' COLLATE NOCASE),
  sort_order = (
    SELECT COALESCE(MAX(s.sort_order), 0) + 1 FROM categories s JOIN categories g ON g.id = s.parent_id
    WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Groceries & Shop' COLLATE NOCASE
  )
WHERE name = 'Groceries' COLLATE NOCASE
  AND parent_id = (SELECT p.id FROM categories p WHERE p.parent_id IS NULL AND p.kind = 'expense' AND p.name = 'Food' COLLATE NOCASE)
  AND EXISTS (SELECT 1 FROM categories g WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Groceries & Shop' COLLATE NOCASE)
  AND NOT EXISTS (
    SELECT 1 FROM categories x JOIN categories g ON g.id = x.parent_id
    WHERE g.parent_id IS NULL AND g.name = 'Groceries & Shop' COLLATE NOCASE AND x.name = 'Groceries' COLLATE NOCASE
  );

INSERT INTO categories (parent_id, name, kind, emoji, color, essential, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color, c.essential,
  (SELECT COALESCE(MAX(s.sort_order), 0) FROM categories s WHERE s.parent_id = p.id) + c.sort_order
FROM (
            SELECT 'Shopping' AS parent, 'Online shopping' AS name, '📦' AS emoji, '#C9A86A' AS color, 0 AS essential, 1 AS sort_order
  UNION ALL SELECT 'Shopping', 'Clothes & Shoes', '👟', '#D49A8A', 0, 2
) AS c
JOIN categories p ON p.name = c.parent COLLATE NOCASE AND p.parent_id IS NULL AND p.kind = 'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id = p.id AND x.name = c.name COLLATE NOCASE
);

UPDATE categories SET
  name = 'Other shopping',
  emoji = CASE WHEN emoji = '🛍️' THEN '🏷️' ELSE emoji END,
  parent_id = (SELECT g.id FROM categories g WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Shopping' COLLATE NOCASE),
  sort_order = (
    SELECT COALESCE(MAX(s.sort_order), 0) + 1 FROM categories s JOIN categories g ON g.id = s.parent_id
    WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Shopping' COLLATE NOCASE
  )
WHERE name = 'Shopping' COLLATE NOCASE
  AND parent_id = (SELECT p.id FROM categories p WHERE p.parent_id IS NULL AND p.kind = 'expense' AND p.name = 'Lifestyle' COLLATE NOCASE)
  AND EXISTS (SELECT 1 FROM categories g WHERE g.parent_id IS NULL AND g.kind = 'expense' AND g.name = 'Shopping' COLLATE NOCASE)
  AND NOT EXISTS (
    SELECT 1 FROM categories x JOIN categories g ON g.id = x.parent_id
    WHERE g.parent_id IS NULL AND g.name = 'Shopping' COLLATE NOCASE AND x.name = 'Other shopping' COLLATE NOCASE
  );

-- 4. Food becomes "Eating out & Treats", only while it is still called Food.
UPDATE categories SET name = 'Eating out & Treats'
WHERE parent_id IS NULL AND kind = 'expense' AND name = 'Food' COLLATE NOCASE
  AND NOT EXISTS (SELECT 1 FROM categories x WHERE x.parent_id IS NULL AND x.name = 'Eating out & Treats' COLLATE NOCASE);

-- 5. New categories, after each group's own. A group the user renamed or
--    deleted gets none.
INSERT INTO categories (parent_id, name, kind, emoji, color, essential, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color, c.essential,
  (SELECT COALESCE(MAX(s.sort_order), 0) FROM categories s WHERE s.parent_id = p.id) + c.sort_order
FROM (
            SELECT 'Groceries & Shop' AS parent, 'Local shop' AS name, '🏪' AS emoji, '#A6C98C' AS color, 1 AS essential, 1 AS sort_order
  UNION ALL SELECT 'Eating out & Treats', 'Small treats', '🍦', '#E8B4A0', 0, 1
  UNION ALL SELECT 'Work', 'Work equipment', '💻', '#8EA3C9', 1, 1
  UNION ALL SELECT 'Work', 'Work travel', '🧳', '#7FB2C2', 1, 2
  UNION ALL SELECT 'Work', 'Work meals', '🥪', '#C9B27F', 1, 3
  UNION ALL SELECT 'Work', 'Courses & training', '📚', '#A59BD3', 1, 4
) AS c
JOIN categories p ON p.name = c.parent COLLATE NOCASE AND p.parent_id IS NULL AND p.kind = 'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id = p.id AND x.name = c.name COLLATE NOCASE
);
