-- Run this ONCE in the D1 Console if your database already had the Projects Calendar
-- before projects had a Department.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE projects ADD COLUMN department TEXT;
