PRAGMA foreign_keys = OFF;

-- Tournament registration control
ALTER TABLE tournaments ADD COLUMN registration_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (registration_status IN ('draft', 'open', 'closed'));
ALTER TABLE tournaments ADD COLUMN registration_opens_at TEXT;
ALTER TABLE tournaments ADD COLUMN reminder_1_days_before INTEGER DEFAULT 7;
ALTER TABLE tournaments ADD COLUMN reminder_1_enabled INTEGER DEFAULT 1;
ALTER TABLE tournaments ADD COLUMN reminder_2_days_before INTEGER DEFAULT 1;
ALTER TABLE tournaments ADD COLUMN reminder_2_enabled INTEGER DEFAULT 1;

-- Opt-in reminders for non-registered members
CREATE TABLE IF NOT EXISTS tournament_reminders (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent_registration_open INTEGER NOT NULL DEFAULT 0,
  sent_week_before INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_reminders_tournament_id
  ON tournament_reminders(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_reminders_member_id
  ON tournament_reminders(member_id);

-- Attendee reminder tracking
CREATE TABLE IF NOT EXISTS tournament_attendee_reminders (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tournament_id, member_id, reminder_number)
);

CREATE INDEX IF NOT EXISTS idx_attendee_reminders_tournament_id
  ON tournament_attendee_reminders(tournament_id);

-- Contact messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread', 'read', 'replied')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_member_id
  ON support_tickets(member_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

-- Support messages (threaded conversation)
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('member', 'admin', 'guest')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id
  ON support_messages(ticket_id);

PRAGMA foreign_keys = ON;
