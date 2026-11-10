-- Run this ONCE in the D1 Console if your database was created before the Inventory page was added.
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  min_qty INTEGER,         -- low stock alert level (optional)
  tag TEXT,                -- asset tag or serial
  notes TEXT,
  updated_at TEXT,
  updated_by TEXT
);
