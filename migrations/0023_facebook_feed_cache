-- migrations/0023_facebook_feed_cache.sql
--
-- Singleton row (id=1) holding the last successfully-fetched Facebook feed.
-- Used as a fallback in functions/api/facebook-posts.ts whenever the live
-- Graph API call fails (rate limited, token expired, network error, etc.)
-- so the site shows real (if slightly stale) posts instead of an error state.

CREATE TABLE IF NOT EXISTS facebook_feed_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  posts_json TEXT NOT NULL DEFAULT '[]',
  cached_at TEXT
);

INSERT OR IGNORE INTO facebook_feed_cache (id, posts_json, cached_at) VALUES (1, '[]', NULL);