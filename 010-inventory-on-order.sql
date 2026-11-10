-- Run this ONCE in the D1 Console to allow Time off viewers who aren't on the schedule (e.g. Kerry Monica).
CREATE TABLE IF NOT EXISTS pto_viewers (
  id TEXT PRIMARY KEY,       -- people who can unlock Time off without being on the schedule
  name TEXT NOT NULL,
  pin_hash TEXT,
  pin_salt TEXT,
  pin_fails INTEGER DEFAULT 0,
  pin_locked_until INTEGER DEFAULT 0
);
