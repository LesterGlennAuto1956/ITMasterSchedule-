-- Run this ONCE in the D1 Console if your database was created before Inventory On Order was added.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  item_id TEXT,            -- inventory item, if linked
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  cost REAL,               -- cost each
  vendor TEXT,
  status TEXT NOT NULL DEFAULT 'Ordered',   -- Ordered, Shipped, Received, Cancelled
  order_date TEXT,
  eta TEXT,
  order_number TEXT,
  notes TEXT,
  created_at TEXT,
  created_by TEXT,
  received_at TEXT,
  received_by TEXT
);
