-- Run this ONCE in the D1 Console if your database already had the Projects Calendar
-- before the Completed / Ongoing project buttons were added.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE projects ADD COLUMN updates TEXT;
ALTER TABLE projects ADD COLUMN completed_at TEXT;
ALTER TABLE projects ADD COLUMN completed_by TEXT;
