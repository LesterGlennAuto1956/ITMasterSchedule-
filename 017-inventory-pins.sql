-- Run this ONCE in the D1 Console for the New Month Schedule requests.
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
  reviewed_at TEXT
);
