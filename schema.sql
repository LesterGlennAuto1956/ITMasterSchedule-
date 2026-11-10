-- Run this once in your D1 database's Console (Cloudflare dashboard > D1 > it-schedule > Console).
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  schedule TEXT,          -- JSON: {"mon":{"start":"08:00","end":"16:30"}, ... "sat":null}
  created_at TEXT,
  location TEXT DEFAULT '',  -- usual starting location
  pin_hash TEXT,             -- 4-digit inventory PIN (salted hash only)
  pin_salt TEXT,
  pin_fails INTEGER DEFAULT 0,
  pin_locked_until INTEGER DEFAULT 0
);
-- Starting location for a single day, when it differs from the usual one.
CREATE TABLE IF NOT EXISTS day_locations (
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  PRIMARY KEY (employee_id, date)
);
CREATE TABLE IF NOT EXISTS allowances (
  employee_id TEXT PRIMARY KEY,
  allowance REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS shifts (
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  off INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  PRIMARY KEY (employee_id, date)
);
CREATE TABLE IF NOT EXISTS remote (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  called_out INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS pto (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  note TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pto_employee ON pto (employee_id);
CREATE INDEX IF NOT EXISTS idx_remote_employee ON remote (employee_id);

-- Projects calendar.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planned',
  location TEXT,
  notes TEXT,
  people TEXT,            -- JSON list of team member ids
  created_at TEXT,
  updates TEXT,           -- JSON list of progress notes: {at, by, leftOff, todo}
  completed_at TEXT,
  completed_by TEXT,
  supplies TEXT,          -- JSON list: {item, qty, got}
  equipment TEXT,         -- JSON list, e.g. ["Scissor Lift"]
  inventory_items TEXT,   -- JSON list: {itemId, name, qty, reserved, used}
  department TEXT
);

-- Sign Out Inventory log.
CREATE TABLE IF NOT EXISTS inventory_signouts (
  id TEXT PRIMARY KEY,
  kind TEXT DEFAULT 'out',   -- 'out' = signed out, 'in' = stock added
  source TEXT,              -- where received stock came from (vendor, by hand)
  department TEXT,
  unit_cost REAL,           -- item cost when it moved
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

-- Inventory on order.
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

-- IT inventory.
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
  updated_by TEXT,
  cost REAL,               -- item cost in dollars
  image TEXT               -- small photo (data URL)
);

-- Where shared equipment is right now.
CREATE TABLE IF NOT EXISTS equipment_status (
  name TEXT PRIMARY KEY,   -- e.g. 'scissor-lift'
  location TEXT,
  updated_at TEXT,
  updated_by TEXT
);

-- Time off viewers (see everyone's time off with their PIN).
CREATE TABLE IF NOT EXISTS pto_viewers (
  id TEXT PRIMARY KEY,       -- people who can unlock Time off without being on the schedule
  name TEXT NOT NULL,
  pin_hash TEXT,
  pin_salt TEXT,
  pin_fails INTEGER DEFAULT 0,
  pin_locked_until INTEGER DEFAULT 0
);

-- New Month Schedule requests.
CREATE TABLE IF NOT EXISTS month_requests (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,        -- e.g. 2026-12
  employee_id TEXT NOT NULL,
  name TEXT,
  kind TEXT NOT NULL,         -- 'weekend' (date = the Saturday) or 'day'
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',   -- new, seen, approved, denied
  created_at TEXT,
  created_by TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  covering TEXT,              -- day-off requests: 'yes' or 'no' for covering that week's Saturday
  saturday TEXT
);

-- People allowed to sign in with Microsoft, and what they can see.
CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,                 -- their Microsoft 365 sign-in, lowercase
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',     -- 'manager' or 'staff'
  ms_oid TEXT,
  last_login INTEGER,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,                 -- the account email
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (username);
-- Short-lived records for sign-ins in progress.
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  next TEXT,
  created_at INTEGER NOT NULL
);
-- The old username/password table isn't used any more.
DROP TABLE IF EXISTS users;
