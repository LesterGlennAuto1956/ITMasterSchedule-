-- Run this ONCE in the D1 Console if your database was created before starting locations were added.
-- (If it says "duplicate column name: location", it has already been run and you can ignore it.)
ALTER TABLE employees ADD COLUMN location TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS day_locations (
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  PRIMARY KEY (employee_id, date)
);
