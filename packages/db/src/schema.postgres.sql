-- Postgres schema for Supabase project sponsor-engine.
-- Project ref: rcoxklwwitbuugcndwto. Region: eu-west-2.
-- Apply this file in the Supabase SQL editor or through the Supabase MCP.
-- Every statement is safe to run again.
-- The hosted app sets DATABASE_URL to the Supavisor transaction pooler on port 6543.
-- The app also applies this file on startup.
--
-- Row level security is on for every table. There are no policies.
-- anon and authenticated cannot read or write these tables.
-- The server connects as the table owner through DATABASE_URL, so it still can.
-- Do not FORCE row level security. That would block the server connection too.

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  focus TEXT,
  url TEXT,
  area TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
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
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  registrations INTEGER,
  check_ins INTEGER,
  show_up_rate DOUBLE PRECISION,
  approx_size INTEGER,
  food_cost_gbp INTEGER,
  food_per_head_gbp DOUBLE PRECISION,
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
  id BIGSERIAL PRIMARY KEY,
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
  show_up_rate DOUBLE PRECISION,
  venue_area TEXT,
  ticket TEXT,
  room_gbp INTEGER,
  food_cost_gbp INTEGER,
  food_per_head_gbp DOUBLE PRECISION,
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

ALTER TABLE requests ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE failures ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'local';

CREATE INDEX IF NOT EXISTS idx_claims_company ON sponsor_claims(company);
CREATE INDEX IF NOT EXISTS idx_claims_sponsor ON sponsor_claims(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);
CREATE INDEX IF NOT EXISTS idx_bookings_kind ON bookings(requester_kind);
CREATE INDEX IF NOT EXISTS idx_tasks_request ON tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_request ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_requests_workspace ON requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outbox_workspace ON outbox(workspace_id);

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE communities FROM PUBLIC;
REVOKE ALL ON TABLE events FROM PUBLIC;
REVOKE ALL ON TABLE sponsors FROM PUBLIC;
REVOKE ALL ON TABLE sponsor_claims FROM PUBLIC;
REVOKE ALL ON TABLE bookings FROM PUBLIC;
REVOKE ALL ON TABLE requests FROM PUBLIC;
REVOKE ALL ON TABLE tasks FROM PUBLIC;
REVOKE ALL ON TABLE quotes FROM PUBLIC;
REVOKE ALL ON TABLE outbox FROM PUBLIC;
REVOKE ALL ON TABLE approvals FROM PUBLIC;
REVOKE ALL ON TABLE agent_runs FROM PUBLIC;
REVOKE ALL ON TABLE failures FROM PUBLIC;
REVOKE ALL ON TABLE venue_files FROM PUBLIC;

-- anon and authenticated exist on Supabase. Skip the revoke where they do not.
DO $sponsor_engine_rls$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'communities',
    'events',
    'sponsors',
    'sponsor_claims',
    'bookings',
    'requests',
    'tasks',
    'quotes',
    'outbox',
    'approvals',
    'agent_runs',
    'failures',
    'venue_files'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', tbl);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'sponsor_claims_id_seq') THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON SEQUENCE sponsor_claims_id_seq FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON SEQUENCE sponsor_claims_id_seq FROM authenticated;
    END IF;
  END IF;
END
$sponsor_engine_rls$;
