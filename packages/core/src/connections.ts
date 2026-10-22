import { integrationStatus } from "./integrations.js";
import { isDryRun } from "./safety.js";

export type ConnectionState = "connected" | "built-in" | "missing" | "coming-soon";

export type ConnectionCard = {
  group: "CRM" | "Memory" | "Data" | "Messaging";
  id: string;
  name: string;
  plain: string;
  state: ConnectionState;
  step: string | null;
};

const CATALOG: ConnectionCard[] = [
  {
    group: "CRM",
    id: "crm-builtin",
    name: "Built-in",
    plain: "Sponsors and deals stay in Sponsor Engine.",
    state: "built-in",
    step: null,
  },
  {
    group: "CRM",
    id: "zero",
    name: "Zero",
    plain: "Copy an approved deal into Zero.",
    state: "built-in",
    step: "To use Zero, set ZERO_API_KEY or add the Zero MCP server.",
  },
  {
    group: "CRM",
    id: "twenty",
    name: "Twenty",
    plain: "Copy an approved deal into Twenty.",
    state: "built-in",
    step: "To use Twenty, set TWENTY_API_URL and TWENTY_API_KEY.",
  },
  {
    group: "CRM",
    id: "hubspot",
    name: "HubSpot",
    plain: "HubSpot is not available yet.",
    state: "coming-soon",
    step: "HubSpot is coming soon.",
  },
  {
    group: "CRM",
    id: "sheets",
    name: "Sheets",
    plain: "Google Sheets is not available yet.",
    state: "coming-soon",
    step: "Sheets is coming soon.",
  },
  {
    group: "Memory",
    id: "memory-builtin",
    name: "Built-in",
    plain: "Past bookings and notes stay on this computer.",
    state: "built-in",
    step: null,
  },
  {
    group: "Memory",
    id: "cognee",
    name: "Cognee",
    plain: "Ask Cognee to remember past events.",
    state: "built-in",
    step: "To use Cognee, set COGNEE_API_KEY or add the Cognee MCP server.",
  },
  {
    group: "Data",
    id: "bundled",
    name: "Bundled London data",
    plain: "Public London events and sponsors are already loaded.",
    state: "built-in",
    step: null,
  },
  {
    group: "Data",
    id: "luma",
    name: "Luma",
    plain: "Read hosts from public Luma event pages.",
    state: "built-in",
    step: "To fetch live Luma events, add the integrations package. No key is required.",
  },
  {
    group: "Data",
    id: "devpost",
    name: "Devpost",
    plain: "Read hackathons from Devpost.",
    state: "built-in",
    step: "To fetch live Devpost hackathons, add the integrations package. No key is required.",
  },
  {
    group: "Data",
    id: "companies-house",
    name: "Companies House",
    plain: "Look up how big a UK company is.",
    state: "built-in",
    step: "To size a company, set COMPANIES_HOUSE_API_KEY.",
  },
  {
    group: "Messaging",
    id: "outbox",
    name: "Test outbox",
    plain: "Messages wait here until you approve them.",
    state: "built-in",
    step: null,
  },
  {
    group: "Messaging",
    id: "email",
    name: "Email",
    plain: "Real email stays off unless you turn it on.",
    state: "built-in",
    step: "To allow a send, set DRY_RUN=false and add the address to ALLOWLIST.",
  },
];

export async function getConnections(): Promise<{ cards: ConnectionCard[]; source: "built-in" | "integrations" }> {
  const reported = await integrationStatus();
  if (reported == null) {
    return { cards: CATALOG.map(applyLocal), source: "built-in" };
  }
  const byId = indexStatus(reported);
  const cards = CATALOG.map((card) => {
    const remote = byId.get(card.id);
    if (!remote) return applyLocal(card);
    return applyRemote(card, remote);
  });
  return { cards, source: "integrations" };
}

function applyRemote(card: ConnectionCard, remote: Remote): ConnectionCard {
  const plain = remote.detail || card.plain;
  const step = remote.missing.length > 0 ? `Set ${remote.missing.join(" and ")}.` : card.step;
  if (!remote.implemented || card.state === "coming-soon") {
    return { ...card, state: "coming-soon", plain, step };
  }
  if (card.id === "crm-builtin" || card.id === "memory-builtin" || card.id === "bundled" || card.id === "outbox") {
    return { ...applyLocal(card), state: "built-in", plain, step: card.step };
  }
  if (remote.missing.length > 0 && !remote.connected) {
    return { ...card, state: "missing", plain, step };
  }
  if (remote.connected) return { ...card, state: "connected", plain, step };
  return { ...card, plain, step };
}

function applyLocal(card: ConnectionCard): ConnectionCard {
  if (card.id === "outbox" && isDryRun()) {
    return { ...card, plain: "Test mode is on. Nothing is sent until you approve it, and approval still does not send." };
  }
  return { ...card };
}

type Remote = {
  detail: string | null;
  implemented: boolean;
  missing: string[];
  connected: boolean;
  active: boolean;
};

function indexStatus(reported: unknown): Map<string, Remote> {
  const map = new Map<string, Remote>();
  const items = asList(reported);
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? record.name ?? "").trim();
    if (!id) continue;
    const missing = Array.isArray(record.missing) ? record.missing.filter((name): name is string => typeof name === "string") : [];
    map.set(normalId(id), {
      detail: typeof record.detail === "string" ? record.detail : typeof record.plain === "string" ? record.plain : null,
      implemented: record.implemented !== false,
      missing,
      connected: record.connected === true,
      active: record.active === true,
    });
  }
  return map;
}

function asList(reported: unknown): unknown[] {
  if (Array.isArray(reported)) return reported;
  if (!reported || typeof reported !== "object") return [];
  const record = reported as Record<string, unknown>;
  if (Array.isArray(record.connections)) return record.connections;
  if (Array.isArray(record.cards)) return record.cards;
  return Object.entries(record).map(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return { id: key, ...(value as object) };
    return { id: key, connected: Boolean(value) };
  });
}

function normalId(id: string): string {
  const value = id.toLowerCase().replace(/[_\s]+/g, "-");
  const aliases: Record<string, string> = {
    zero: "zero",
    "zero-crm": "zero",
    "local-crm": "crm-builtin",
    twenty: "twenty",
    hubspot: "hubspot",
    sheets: "sheets",
    "google-sheets": "sheets",
    cognee: "cognee",
    memory: "cognee",
    "local-memory": "memory-builtin",
    luma: "luma",
    devpost: "devpost",
    "companies-house": "companies-house",
    companieshouse: "companies-house",
    email: "email",
    outbox: "outbox",
    builtin: "crm-builtin",
    "built-in": "crm-builtin",
    bundled: "bundled",
    "bundled-data": "bundled",
  };
  return aliases[value] ?? value;
}
