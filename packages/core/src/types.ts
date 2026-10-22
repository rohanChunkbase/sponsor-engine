export type RequesterKind = "community" | "company" | "unknown";

export type RequestRow = {
  id: string;
  channel: string | null;
  raw_message: string;
  sender_name: string | null;
  sender_handle: string | null;
  organisation: string | null;
  requester_kind: RequesterKind | null;
  event_date: string | null;
  headcount: number | null;
  needs_json: string | null;
  venue_hint: string | null;
  status: string;
  suggested_reply: string | null;
  created_at: string;
};

export type BookingRow = {
  id: string;
  event_id: string | null;
  community_id: string | null;
  title: string;
  date: string | null;
  requester_kind: string;
  headcount: number | null;
  registrations: number | null;
  check_ins: number | null;
  show_up_rate: number | null;
  venue_area: string | null;
  ticket: string | null;
  room_gbp: number | null;
  food_cost_gbp: number | null;
  food_per_head_gbp: number | null;
  price_gbp: number;
  is_sample: string | null;
  notes: string | null;
};

export type SponsorMatch = {
  sponsor_id: string;
  company: string;
  website: string | null;
  category: string | null;
  score: number;
  is_sample: string | null;
  london_events: number;
  food_or_drinks_events: number;
  venue_events: number;
  reasons: string[];
  sources: Array<{
    url: string;
    quote: string;
    role: string;
    confidence: string;
    event_name: string;
    community: string;
  }>;
  company_size?: {
    note: string;
    matched_name: string | null;
    via: string;
    source_url: string | null;
  } | null;
};

export type OutboxRow = {
  id: string;
  kind: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  request_id: string | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  ask_gbp: number | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
};
