-- Nested categories (spec 34, F69): up to three levels, every level a real
-- category, the same kind all the way down.
--
-- The two-level triggers of 0002 (remade in 0006) give way to these. With
-- at most three levels, a category's place is found with plain joins: its
-- parent and its parent's parent above, its children and grandchildren below.
-- Core checks the same rules first and answers with a fixed code.

DROP TRIGGER categories_two_levels_insert;
DROP TRIGGER categories_two_levels_update;

-- A new category goes under a category of its own kind at level 1 or 2.
CREATE TRIGGER categories_tree_insert
BEFORE INSERT ON categories
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'category parent must be a category of the same kind')
  WHERE NOT EXISTS (SELECT 1 FROM categories p WHERE p.id = NEW.parent_id AND p.kind = NEW.kind);
  SELECT RAISE(ABORT, 'categories nest at most three levels')
  WHERE EXISTS (
    SELECT 1 FROM categories p JOIN categories g ON g.id = p.parent_id
    WHERE p.id = NEW.parent_id AND g.parent_id IS NOT NULL
  );
END;

-- A move (or a kind change) keeps: the parent's kind, the children's kind,
-- no category under itself or its own subcategory, and the whole moved
-- branch within three levels (the parent's level plus the branch's height).
CREATE TRIGGER categories_tree_update
BEFORE UPDATE OF parent_id, kind ON categories
BEGIN
  SELECT RAISE(ABORT, 'category parent must be a category of the same kind')
  WHERE NEW.parent_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM categories p WHERE p.id = NEW.parent_id AND p.kind = NEW.kind);
  SELECT RAISE(ABORT, 'a category keeps the kind of its subcategories')
  WHERE EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id AND c.kind <> NEW.kind);
  SELECT RAISE(ABORT, 'a category cannot go under itself or its own subcategory')
  WHERE NEW.parent_id = NEW.id
    OR EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.parent_id AND c.parent_id = NEW.id)
    OR EXISTS (
      SELECT 1 FROM categories c JOIN categories gc ON gc.parent_id = c.id
      WHERE c.parent_id = NEW.id AND gc.id = NEW.parent_id
    );
  SELECT RAISE(ABORT, 'categories nest at most three levels')
  WHERE NEW.parent_id IS NOT NULL
    AND (
      SELECT 1 + (p.parent_id IS NOT NULL)
        + COALESCE((SELECT g.parent_id IS NOT NULL FROM categories g WHERE g.id = p.parent_id), 0)
      FROM categories p WHERE p.id = NEW.parent_id
    )
    + 1
    + EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id)
    + EXISTS (SELECT 1 FROM categories c JOIN categories gc ON gc.parent_id = c.id WHERE c.parent_id = NEW.id)
    > 3;
END;

-- New defaults (spec 34, F70), for new and existing profiles. As in 0013,
-- only categories that still have their default name and place get them: a
-- parent the user renamed, moved or deleted gets none, and a name already
-- there (any case) is skipped. Nothing is moved or renamed, no row changes
-- category, and the Routine / Treats column is left empty (spec 34, F72).

-- Level 3: inside Groceries & Shop › Groceries and Transportation › Transport.
INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color,
  (SELECT COALESCE(MAX(s.sort_order), 0) FROM categories s WHERE s.parent_id = p.id) + c.sort_order
FROM (
            SELECT 'Groceries & Shop' AS grandparent, 'Groceries' AS parent, 'Weekly shop' AS name, '🥦' AS emoji, '#74AC76' AS color, 1 AS sort_order
  UNION ALL SELECT 'Groceries & Shop', 'Groceries', 'Top-up', '🥛', '#96C696', 2
  UNION ALL SELECT 'Groceries & Shop', 'Groceries', 'Specialty food', '🧀', '#A9BE78', 3
  UNION ALL SELECT 'Transportation', 'Transport', 'Bus', '🚍', '#5BA4CC', 1
  UNION ALL SELECT 'Transportation', 'Transport', 'Train', '🚆', '#74BEDA', 2
) AS c
JOIN categories g ON g.name = c.grandparent COLLATE NOCASE AND g.parent_id IS NULL AND g.kind = 'expense'
JOIN categories p ON p.name = c.parent COLLATE NOCASE AND p.parent_id = g.id AND p.kind = 'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id = p.id AND x.name = c.name COLLATE NOCASE
);

-- Level 2: inside Transportation, after Fuel and Parking.
INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color,
  (SELECT COALESCE(MAX(s.sort_order), 0) FROM categories s WHERE s.parent_id = p.id) + c.sort_order
FROM (
            SELECT 'Transportation' AS parent, 'Taxi & rides' AS name, '🚕' AS emoji, '#7A8FD4' AS color, 1 AS sort_order
  UNION ALL SELECT 'Transportation', 'Tolls', '🛣️', '#6E86B8', 2
  UNION ALL SELECT 'Transportation', 'Car repairs', '🔧', '#8A86C8', 3
  UNION ALL SELECT 'Transportation', 'Car insurance', '☂️', '#7C9CC6', 4
  UNION ALL SELECT 'Transportation', 'Car license & test', '📋', '#95A0CF', 5
) AS c
JOIN categories p ON p.name = c.parent COLLATE NOCASE AND p.parent_id IS NULL AND p.kind = 'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id = p.id AND x.name = c.name COLLATE NOCASE
);
