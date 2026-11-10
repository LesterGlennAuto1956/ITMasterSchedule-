-- Run this ONCE in the D1 Console if your database already had Inventory History
-- before "Coming from" was added.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE inventory_signouts ADD COLUMN source TEXT;
