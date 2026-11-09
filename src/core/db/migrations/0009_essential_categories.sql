-- Essential or extra, and new default categories (spec 18).
--
-- 1. Spending subcategories get `essential`: 1 essential, 0 extra. Groups
--    (top level) and income and transfer categories keep NULL. Every
--    spending subcategory starts essential, then the seeded extras by name.
--    So a category the user made counts as essential until they say not.
--
-- 2. New defaults under Transportation, Food and Lifestyle. A group the
--    user renamed or deleted gets none of its additions, and a name that
--    already exists under the group (any case) is skipped. Nothing the user
--    has is moved, renamed or recolored, and no row changes its category.

ALTER TABLE categories ADD COLUMN essential INTEGER CHECK (essential IN (0, 1));

UPDATE categories SET essential = 1
WHERE kind = 'expense' AND parent_id IS NOT NULL;

UPDATE categories SET essential = 0
WHERE kind = 'expense' AND parent_id IS NOT NULL AND name IN (
  'Restaurants', 'Coffee & Cafes', 'Bars', 'Entertainment', 'Shopping', 'Travel',
  'Vacation', 'Impulsive buying', 'Sports & Hobbies', 'Personal Care',
  'Subscriptions', 'Gifts & Donations'
);

INSERT INTO categories (parent_id, name, kind, emoji, color, essential, sort_order)
SELECT p.id, c.name, 'expense', c.emoji, c.color, c.essential,
  (SELECT COALESCE(MAX(s.sort_order), 0) FROM categories s WHERE s.parent_id = p.id) + c.sort_order
FROM (
            SELECT 'Transportation' AS parent, 'Fuel' AS name, '⛽' AS emoji, '#8E9BD8' AS color, 1 AS essential, 1 AS sort_order
  UNION ALL SELECT 'Transportation', 'Parking', '🅿️', '#9AA8C4', 1, 2
  UNION ALL SELECT 'Food', 'Bars', '🍺', '#D9A05B', 0, 1
  UNION ALL SELECT 'Lifestyle', 'Vacation', '🏖️', '#6CC4C9', 0, 1
  UNION ALL SELECT 'Lifestyle', 'Impulsive buying', '⚡', '#E58FA0', 0, 2
) AS c
JOIN categories p ON p.name = c.parent AND p.parent_id IS NULL AND p.kind = 'expense'
WHERE NOT EXISTS (
  SELECT 1 FROM categories x WHERE x.parent_id = p.id AND x.name = c.name COLLATE NOCASE
);
