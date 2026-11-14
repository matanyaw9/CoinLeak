-- Budgets (spec 27). A monthly budget per spending category, in agorot.
-- NULL means no budget. Only spending (expense) categories may have one,
-- groups and subcategories alike. The weekly budget is not stored: it is
-- always the monthly one divided by four, rounded down.

ALTER TABLE categories ADD COLUMN monthly_budget INTEGER
  CHECK (monthly_budget IS NULL OR (monthly_budget > 0 AND kind = 'expense'));
