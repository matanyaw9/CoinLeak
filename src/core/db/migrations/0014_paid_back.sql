-- Paid back for a purchase (spec 33, F65): money in that pays back part of
-- a purchase points at that purchase. Null for every existing row. Deleting
-- the purchase for good lets go of the link; the row keeps its category.
ALTER TABLE transactions ADD COLUMN paid_back_for INTEGER REFERENCES transactions (id) ON DELETE SET NULL;
