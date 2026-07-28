-- Singleton row (id=1 always) for a site-wide announcement banner you can
-- toggle on/off and edit from an admin panel. One banner at a time, by
-- design — matches "the banner" as a single thing to manage, not a list.

CREATE TABLE IF NOT EXISTS site_announcement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  link_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

INSERT OR IGNORE INTO site_announcement (id, enabled, message) VALUES (1, 0, '');