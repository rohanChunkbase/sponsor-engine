-- Sponsor Engine. SQLite is the default database.
-- SAMPLE rows are fictional. Real rows come from public event pages.

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  focus TEXT,
  url TEXT,
  area TEXT,
  lat REAL,
  lon REAL,
  members_estimate INTEGER,
  organiser_name TEXT,
  events_found INTEGER,
  sponsor_companies TEXT,
  is_sample TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  community_id TEXT,
  community_name TEXT,
  title TEXT NOT NULL,
  date TEXT,
  status TEXT,
  venue TEXT,
  area TEXT,
  lat REAL,
  lon REAL,
  registrations INTEGER,
  check_ins INTEGER,
  show_up_rate REAL,
  approx_size INTEGER,
  food_cost_gbp INTEGER,
  food_per_head_gbp REAL,
  ticket TEXT,
  url TEXT,
  source_url TEXT,
  platform TEXT,
  is_sample TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  website TEXT,
  category TEXT,
  roles TEXT,
  london_events INTEGER,
  london_events_stated INTEGER,
  food_or_drinks_events INTEGER,
  venue_events INTEGER,
  typical_ask_gbp INTEGER,
  in_kind TEXT,
  audiences TEXT,
  contact_role TEXT,
  evidence_urls TEXT,
  notes TEXT,
  is_sample TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS sponsor_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  event_name TEXT,
  event_date TEXT,
  community TEXT,
  company TEXT,
  sponsor_id TEXT,
  role TEXT,
  confidence TEXT,
  evidence_quote TEXT,
  source_url TEXT,
  is_sample TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  community_id TEXT,
  title TEXT NOT NULL,
  date TEXT,
  requester_kind TEXT NOT NULL,
  headcount INTEGER,
  registrations INTEGER,
  check_ins INTEGER,
  show_up_rate REAL,
  venue_area TEXT,
  ticket TEXT,
  room_gbp INTEGER,
  food_cost_gbp INTEGER,
  food_per_head_gbp REAL,
  price_gbp INTEGER NOT NULL,
  is_sample TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  channel TEXT,
  raw_message TEXT NOT NULL,
  sender_name TEXT,
  sender_handle TEXT,
  organisation TEXT,
  requester_kind TEXT,
  event_date TEXT,
  headcount INTEGER,
  needs_json TEXT,
  venue_hint TEXT,
  status TEXT NOT NULL,
  suggested_reply TEXT,
  created_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL,
  explanation TEXT NOT NULL,
  comparables_json TEXT,
  requester_kind TEXT,
  lines_json TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  request_id TEXT,
  sponsor_id TEXT,
  sponsor_name TEXT,
  ask_gbp INTEGER,
  blocked_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  request_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS failures (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  request_id TEXT,
  message TEXT NOT NULL,
  raw_input TEXT,
  created_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS venue_files (
  workspace_id TEXT PRIMARY KEY,
  csv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_company ON sponsor_claims(company);
CREATE INDEX IF NOT EXISTS idx_claims_sponsor ON sponsor_claims(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);
CREATE INDEX IF NOT EXISTS idx_bookings_kind ON bookings(requester_kind);
CREATE INDEX IF NOT EXISTS idx_tasks_request ON tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_request ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
