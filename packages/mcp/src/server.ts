import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  approveOutbox,
  draftSponsorAsk,
  findSponsors,
  forecastTurnout,
  getReadyDb,
  listFailures,
  quoteBooking,
  recallHistory,
  sendWithApproval,
  triageInbound,
} from "@sponsor-engine/core";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function buildServer() {
  const server = new McpServer({ name: "sponsor-engine", version: "0.1.0" });

  server.registerTool(
    "triage_inbound",
    {
      title: "Read an inbound message",
      description: "Read a chat message. Record who is asking, whether they are a community or a company, the date, the headcount, and what they need. Create a task with an owner and a priority. Log a failure when the message cannot be read. The reply waits for a person.",
      inputSchema: {
        message: z.string().describe("The chat message"),
        channel: z.string().optional().describe("whatsapp, email, or web"),
        sender_name: z.string().optional(),
      },
    },
    async (args) => text(triageInbound(getReadyDb(), args)),
  );

  server.registerTool(
    "quote_booking",
    {
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
    },
    async (args) => text(await quoteBooking(getReadyDb(), args)),
  );

  server.registerTool(
    "find_sponsors",
    {
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
    },
    async (args) => text(await findSponsors(getReadyDb(), args)),
  );

  server.registerTool(
    "forecast_turnout",
    {
      title: "Forecast turnout",
      description: "Estimate how many people will come. Uses this community's history when it has at least three events. Otherwise uses the free-event no-show benchmark of 28%.",
      inputSchema: {
        headcount: z.number(),
        requester_kind: z.enum(["community", "company", "unknown"]).optional(),
        community_name: z.string().optional(),
        request_id: z.string().optional(),
      },
    },
    async (args) => text(forecastTurnout(getReadyDb(), args)),
  );

  server.registerTool(
    "draft_sponsor_ask",
    {
      title: "Draft a sponsor email",
      description: "Draft a right-sized sponsor ask from the turnout forecast, about £5.50 per person for food. Put the email in the outbox. Do not send it.",
      inputSchema: {
        request_id: z.string().optional(),
        sponsor_id: z.string().optional(),
        sponsor_name: z.string().optional(),
        headcount: z.number().optional(),
        community: z.string().optional(),
      },
    },
    async (args) => text(await draftSponsorAsk(getReadyDb(), args)),
  );

  server.registerTool(
    "send_with_approval",
    {
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
    },
    async (args) => text(sendWithApproval(getReadyDb(), {
      recipient: args.recipient,
      subject: args.subject,
      body: args.body,
      kind: args.kind,
      requestId: args.request_id,
      sponsorId: args.sponsor_id,
      sponsorName: args.sponsor_name,
      askGbp: args.ask_gbp,
    })),
  );

  server.registerTool(
    "approve",
    {
      title: "Approve a waiting message",
      description: "Move an outbox item to approved. In test mode this only logs and does not send. Calls pushDeal when packages/integrations is present.",
      inputSchema: {
        outbox_id: z.string(),
        actor: z.string().optional(),
      },
    },
    async (args) => text(await approveOutbox(getReadyDb(), args.outbox_id, args.actor ?? "mcp")),
  );

  server.registerTool(
    "list_failures",
    {
      title: "List failures",
      description: "Show messages the assistant could not read.",
      inputSchema: {
        limit: z.number().optional(),
      },
    },
    async (args) => text(listFailures(getReadyDb(), args.limit ?? 20)),
  );

  server.registerTool(
    "recall_history",
    {
      title: "Recall history",
      description: "Look up past events, bookings, and sponsor notes. Uses Cognee recall when packages/integrations is present. Uses the local database otherwise.",
      inputSchema: {
        query: z.string(),
      },
    },
    async (args) => text(await recallHistory(getReadyDb(), args.query)),
  );

  return server;
}
