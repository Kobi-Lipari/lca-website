-- migrations/0037_lca_posts.sql
--
-- LCA news posts, written and edited by admins on the site. Replaces the
-- three announcements that were typed into NewsPage.tsx, which is why those
-- three are inserted below — the News page keeps showing them.
--
-- Each post gets its own page at /news/<slug>, with its own link preview,
-- so a post can be shared to Facebook and show its title and picture there.
CREATE TABLE IF NOT EXISTS lca_posts (
  id TEXT PRIMARY KEY,
  -- The URL part. Unique; fixed once published so shared links keep working.
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  -- One or two sentences for cards and link previews.
  summary TEXT NOT NULL DEFAULT '',
  -- The full post (rich text from the editor; sanitised on save).
  body_html TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  -- Optional call to action, e.g. "Register" → /tournaments/xyz.
  link_url TEXT,
  link_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- Pinned posts sort first on the News page.
  pinned INTEGER NOT NULL DEFAULT 0,
  -- The date shown on the post. Set on first publish; editable.
  published_at TEXT,
  created_by TEXT REFERENCES members(id),
  updated_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lca_posts_status_date ON lca_posts(status, published_at);

INSERT OR IGNORE INTO lca_posts (id, slug, title, summary, link_url, link_label, status, published_at)
VALUES
  ('post-calendar-2025-26', '2025-26-tournament-calendar-published',
   '2025–26 tournament calendar published',
   'The full calendar of LCA-sanctioned events is now available on the tournaments page.',
   '/tournaments', 'See tournaments', 'published', '2025-07-14'),
  ('post-board-elected', 'new-board-members-elected',
   'New board members elected at annual meeting',
   'The LCA held its annual meeting on June 28. See governance for the updated board listing.',
   '/governance/board', 'Meet the board', 'published', '2025-12-01'),
  ('post-website-live', 'lca-website-now-live',
   'LCA website now live at louisianachess.org',
   'Our new site is up. Member registration, tournament registration, and club info are all available online.',
   '/', 'Visit the homepage', 'published', '2026-07-01');
