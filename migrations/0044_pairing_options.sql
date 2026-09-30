-- 0044_pairing_options.sql
--
-- tournaments.accelerated     1 = accelerated pairings (US Chess 28R,
--                             added-score method) for the first two rounds.
-- tournaments.keep_apart      who the pairing engine tries to keep apart:
--                             'family' (default: parents, children and
--                             siblings on one family account), 'family_club'
--                             (also players from the same club), or 'none'.
--                             A soft preference: never at the cost of the
--                             score groups.

ALTER TABLE tournaments ADD COLUMN accelerated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN keep_apart TEXT NOT NULL DEFAULT 'family';
