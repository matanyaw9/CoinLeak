-- Pending lifecycle (spec 04). A pending row that a later download no longer
-- contains is marked gone instead of deleted: it counts nowhere and waits in
-- review until the user deletes it or a later download brings it back.
--
-- `status` keeps what the bank last said, which for a gone row is always
-- 'pending'. `gone_at` is when a sync first found the row missing (ISO UTC);
-- NULL while the bank reports it. The ledger shows status 'gone' when set.

ALTER TABLE transactions ADD COLUMN gone_at TEXT CHECK (gone_at IS NULL OR status = 'pending');
