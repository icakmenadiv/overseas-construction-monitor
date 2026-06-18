CREATE TABLE IF NOT EXISTS article_interest_counts (
  article_id TEXT PRIMARY KEY,
  article_title TEXT,
  article_url TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_interest_votes (
  article_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (article_id, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_article_interest_votes_visitor
  ON article_interest_votes (visitor_hash, active);

CREATE INDEX IF NOT EXISTS idx_article_interest_counts_count
  ON article_interest_counts (count DESC, updated_at DESC);
