-- Run this ONCE in the D1 Console if your database was created before "Where is Scissor Lift Currently?" was added.
CREATE TABLE IF NOT EXISTS equipment_status (
  name TEXT PRIMARY KEY,   -- e.g. 'scissor-lift'
  location TEXT,
  updated_at TEXT,
  updated_by TEXT
);
