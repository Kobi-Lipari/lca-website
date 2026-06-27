-- migrations/0011_governance.sql
-- Board members table
CREATE TABLE IF NOT EXISTS board_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Governance documents table (bylaws, rules, minutes, reports, amendments)
CREATE TABLE IF NOT EXISTS governance_documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  category TEXT NOT NULL, -- 'bylaws' | 'rules' | 'minutes' | 'treasurer' | 'amendments'
  title TEXT NOT NULL,
  filename TEXT,
  file_url TEXT,
  doc_date TEXT,
  year INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed default board roles (empty names — admin fills in)
INSERT INTO board_members (role, name, sort_order) VALUES
  ('President', 'TBD', 1),
  ('Vice President', 'TBD', 2),
  ('Secretary', 'TBD', 3),
  ('Treasurer', 'TBD', 4),
  ('Tournament Director', 'TBD', 5),
  ('Scholastic Director', 'TBD', 6),
  ('Webmaster', 'TBD', 7);