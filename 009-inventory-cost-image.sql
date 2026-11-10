-- Run this ONCE in the D1 Console if your database was created before Sign Out Inventory was added.
CREATE TABLE IF NOT EXISTS inventory_signouts (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  item_name TEXT,
  category TEXT,
  qty INTEGER NOT NULL,
  signed_out_by TEXT,
  to_location TEXT,
  project_id TEXT,
  project_name TEXT,
  notes TEXT,
  from_location TEXT,      -- where the item was stored
  at TEXT,
  recorded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_signouts_at ON inventory_signouts (at);
