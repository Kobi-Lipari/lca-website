-- migrations/0031_multiple_announcements.sql
--
-- Several banners at once, instead of one.
--
-- 0022 made the announcement a singleton on purpose — "the banner" as one
-- thing to manage. That held until two things needed saying at the same
-- time: State Championship registration and the annual business meeting.
-- The old table cannot simply grow a second row, because its primary key
-- carries CHECK (id = 1), and SQLite has no way to drop a CHECK without
-- rebuilding the table. So: a new one, and the existing row moves across.
--
-- site_announcement is left in place rather than dropped. Nothing reads it
-- after this, but it costs nothing and the row is the only record of what
-- was on the site before today.

CREATE TABLE IF NOT EXISTS site_announcements (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  message TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  link_label TEXT,

  -- Visual treatment. Every one of these is checked against its own text
  -- colour and clears AA: gold 6.51:1, navy 14.81:1, urgent 8.15:1,
  -- info 8.74:1. Adding a tone means checking the new pairing too.
  tone TEXT NOT NULL DEFAULT 'gold' CHECK (tone IN ('gold', 'navy', 'urgent', 'info')),

  -- 'compact' is a single tighter line for a standing notice; 'default'
  -- is the existing height and suits the one thing you most want read.
  size TEXT NOT NULL DEFAULT 'default' CHECK (size IN ('compact', 'default')),

  -- Lower sorts first, so the most important banner sits on top.
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Optional window. Both null means "on until switched off", which is how
  -- the old singleton behaved. An end date is what stops a meeting banner
  -- outliving its meeting because nobody remembered to take it down.
  starts_at TEXT,
  ends_at TEXT,

  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- The live banner keeps its text, its link and its enabled state.
INSERT OR IGNORE INTO site_announcements
  (id, enabled, message, link_url, link_label, tone, size, sort_order, updated_at, updated_by)
SELECT
  'ann-legacy-1', enabled, message, link_url, link_label, 'gold', 'default', 0, updated_at, updated_by
FROM site_announcement
WHERE id = 1;

-- The banner list is read on every page load, so the common query — enabled,
-- in order — should not be a scan.
CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON site_announcements(enabled, sort_order);
