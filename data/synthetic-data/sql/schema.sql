-- SAMPLE / FICTIONAL hackathon demo data. Schema generated from csv/.

DROP TABLE IF EXISTS "communities";
CREATE TABLE "communities" (
  "community_id" text PRIMARY KEY,
  "name" text,
  "focus" text,
  "members_estimate" integer,
  "area" text,
  "lat" double precision,
  "lon" double precision,
  "organiser_name" text,
  "organiser_handle" text,
  "channels" text,
  "free_events" boolean,
  "is_sample" text
);
COMMENT ON TABLE "communities" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "edges";
CREATE TABLE "edges" (
  "source" text,
  "target" text,
  "shared_members" integer,
  "co_hosted_events" integer,
  "shared_sponsors" integer,
  "shared_speakers" integer,
  "weight" integer,
  "is_sample" text
);
COMMENT ON TABLE "edges" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "events";
CREATE TABLE "events" (
  "event_id" text PRIMARY KEY,
  "community_id" text,
  "title" text,
  "date" text,
  "weekday" text,
  "venue_sponsor_id" text,
  "venue_area" text,
  "lat" double precision,
  "lon" double precision,
  "registrations" integer,
  "check_ins" integer,
  "show_up_rate" double precision,
  "food_cost_gbp" integer,
  "food_per_head_gbp" double precision,
  "food_sponsor_id" text,
  "co_host_ids" text,
  "ticket" text,
  "is_sample" text
);
COMMENT ON TABLE "events" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "organiser_contacts_c01";
CREATE TABLE "organiser_contacts_c01" (
  "contact_id" text PRIMARY KEY,
  "owner_community_id" text,
  "name" text,
  "role" text,
  "company" text,
  "sponsor_id" text,
  "relationship" text,
  "warmth_1to5" integer,
  "last_contact" text,
  "linkedin_connection" boolean,
  "met_at_event_id" text,
  "email" text,
  "source" text,
  "is_sample" text
);
COMMENT ON TABLE "organiser_contacts_c01" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "speakers";
CREATE TABLE "speakers" (
  "speaker_id" text PRIMARY KEY,
  "name" text,
  "topic" text,
  "is_sample" text
);
COMMENT ON TABLE "speakers" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "sponsor_deals";
CREATE TABLE "sponsor_deals" (
  "deal_id" text PRIMARY KEY,
  "event_id" text,
  "sponsor_id" text,
  "asked_on" text,
  "ask_gbp" integer,
  "replied" boolean,
  "outcome" text,
  "amount_gbp" integer,
  "notes" text,
  "is_sample" text
);
COMMENT ON TABLE "sponsor_deals" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "sponsors";
CREATE TABLE "sponsors" (
  "sponsor_id" text PRIMARY KEY,
  "company" text,
  "category" text,
  "typical_ask_gbp" integer,
  "in_kind" text,
  "audiences_sponsored" text,
  "contact_role" text,
  "contact_channel" text,
  "website" text,
  "is_sample" text
);
COMMENT ON TABLE "sponsors" IS 'SAMPLE / FICTIONAL demo data';

DROP TABLE IF EXISTS "talks";
CREATE TABLE "talks" (
  "speaker_id" text,
  "event_id" text,
  "is_sample" text
);
COMMENT ON TABLE "talks" IS 'SAMPLE / FICTIONAL demo data';

