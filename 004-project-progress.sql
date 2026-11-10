-- Run this ONCE in the D1 Console if your database was created before inventory PINs were added.
-- (If it says "duplicate column name", it has already been run and you can ignore it.)
ALTER TABLE employees ADD COLUMN pin_hash TEXT;
ALTER TABLE employees ADD COLUMN pin_salt TEXT;
ALTER TABLE employees ADD COLUMN pin_fails INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN pin_locked_until INTEGER DEFAULT 0;
