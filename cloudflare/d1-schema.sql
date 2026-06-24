CREATE TABLE IF NOT EXISTS view_counts (
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (target_type, target_id, event_type)
);

CREATE TABLE IF NOT EXISTS recent_view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  source_url TEXT,
  page_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_view_events_dedupe
  ON recent_view_events (target_type, target_id, event_type, session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_recent_view_events_created_at
  ON recent_view_events (created_at);
