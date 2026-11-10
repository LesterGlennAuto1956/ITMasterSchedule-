-- Run this ONCE in the D1 Console if your database already had Sign Out Inventory
-- before Inventory Metrics was added.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE inventory_signouts ADD COLUMN department TEXT;
ALTER TABLE inventory_signouts ADD COLUMN unit_cost REAL;
