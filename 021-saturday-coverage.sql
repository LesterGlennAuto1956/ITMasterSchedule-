-- Run this ONCE in the D1 Console if your database already had the Projects Calendar
-- before Inventory Needed was added to projects.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE projects ADD COLUMN inventory_items TEXT;
