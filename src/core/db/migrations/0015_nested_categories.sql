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
