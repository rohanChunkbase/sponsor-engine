import { z, type ZodRawShape } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { DEMO_MESSAGE, getReadyDb, runAskTool } from "@sponsor-engine/core";
import { runWithWorkspace } from "@sponsor-engine/db";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function scoped<T>(workspaceId: string | null, fn: () => T): T {
  if (!workspaceId) return fn();
  return runWithWorkspace(workspaceId, fn);
}

type ToolHost = {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: ZodRawShape },
    cb: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }>,
  ) => void;
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  example: Record<string, unknown>;
  run: (args: Record<string, unknown>, workspaceId: string | null) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
};

const tools: ToolDef[] = [
  {
    name: "triage_inbound",
    title: "Read an inbound message",
    description: "Read a chat message. Record who is asking, whether they are a community or a company, the date, the headcount, and what they need. Create a task with an owner and a priority. Log a failure when the message cannot be read. The reply waits for a person.",
    inputSchema: {
      message: z.string().describe("The chat message"),
      channel: z.string().optional().describe("whatsapp, email, or web"),
      sender_name: z.string().optional(),
    },
    example: { message: DEMO_MESSAGE, channel: "whatsapp" },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "triage_inbound", args))),
  },
  {
    name: "quote_booking",
    title: "Quote a booking",
    description: "Price a booking from past bookings and explain the community rate and the company rate in plain language. Uses packages/pricing quotePrice when that package is present.",
    inputSchema: {
      request_id: z.string().optional(),
      requester_kind: z.enum(["community", "company", "unknown"]).optional(),
      headcount: z.number().optional(),
      date: z.string().optional(),
      community_name: z.string().optional(),
      needs: z.array(z.string()).optional(),
    },
    example: { requester_kind: "community", headcount: 120, date: "2026-11-28", community_name: "Unicorn Mafia", needs: ["food", "room"] },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "quote_booking", args))),
  },
  {
    name: "find_sponsors",
    title: "Find sponsors",
    description: "Rank sponsors for an event from past London backing, food or venue fit, and size. Return reasons and source URLs. Calls companySize and lumaEventHosts when packages/integrations is present.",
    inputSchema: {
      request_id: z.string().optional(),
      community: z.string().optional(),
      headcount: z.number().optional(),
      needs: z.array(z.string()).optional(),
      focus: z.string().optional(),
      limit: z.number().optional(),
      include_sample: z.boolean().optional(),
    },
    example: { community: "Unicorn Mafia", headcount: 120, needs: ["food", "room"], limit: 3 },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "find_sponsors", args))),
  },
  {
    name: "forecast_turnout",
    title: "Forecast turnout",
    description: "Estimate how many people will come. Uses this community's history when it has at least three events. Otherwise uses the free-event no-show benchmark of 28%.",
    inputSchema: {
      headcount: z.number(),
      requester_kind: z.enum(["community", "company", "unknown"]).optional(),
      community_name: z.string().optional(),
      request_id: z.string().optional(),
    },
    example: { headcount: 120, requester_kind: "community", community_name: "Unicorn Mafia" },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "forecast_turnout", args))),
  },
  {
    name: "draft_sponsor_ask",
    title: "Draft a sponsor email",
    description: "Draft a right-sized sponsor ask from the turnout forecast, about £5.50 per person for food. Put the email in the outbox. Do not send it.",
    inputSchema: {
      request_id: z.string().optional(),
      sponsor_id: z.string().optional(),
      sponsor_name: z.string().optional(),
      headcount: z.number().optional(),
      community: z.string().optional(),
    },
    example: { sponsor_name: "Pydantic", headcount: 120, community: "Unicorn Mafia" },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "draft_sponsor_ask", args))),
  },
  {
    name: "send_with_approval",
    title: "Queue a message for approval",
    description: "Never sends. Writes the message to the outbox with status awaiting_approval.",
    inputSchema: {
      recipient: z.string(),
      subject: z.string(),
      body: z.string(),
      kind: z.string().optional(),
      request_id: z.string().optional(),
      sponsor_id: z.string().optional(),
      sponsor_name: z.string().optional(),
      ask_gbp: z.number().optional(),
    },
    example: {
      recipient: "desk@example.com",
      subject: "Room for Thursday",
      body: "We would like the room for a community evening. This note waits for a person.",
      kind: "chat_reply",
    },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "send_with_approval", args))),
  },
  {
    name: "list_failures",
    title: "List failures",
    description: "Show messages the assistant could not read.",
    inputSchema: {
      limit: z.number().optional(),
    },
    example: { limit: 5 },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "list_failures", args))),
  },
  {
    name: "recall_history",
    title: "Recall history",
    description: "Look up past events, bookings, and sponsor notes. Uses Cognee recall when packages/integrations is present. Uses the local database otherwise.",
    inputSchema: {
      query: z.string(),
    },
    example: { query: "Unicorn Mafia" },
    run: async (args, workspaceId) => text(await scoped(workspaceId, () => runAskTool(getReadyDb(), "recall_history", args))),
  },
];

export type ToolCard = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  example: Record<string, unknown>;
};

export function listTools(): ToolCard[] {
  return tools.map((tool) => {
    const inputSchema = zodToJsonSchema(z.object(tool.inputSchema), { target: "jsonSchema7" }) as Record<string, unknown>;
    delete inputSchema.$schema;
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema,
      example: tool.example,
    };
  });
}

/** Register the public tools. Approve is absent on purpose. A person approves on the dashboard. */
export function registerTools(server: ToolHost, workspaceId: string | null = null): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      (args) => tool.run(args, workspaceId),
    );
  }
}
