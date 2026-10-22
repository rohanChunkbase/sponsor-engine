import assert from "node:assert/strict";
import { after, test } from "node:test";
import { acceptInbound, chatCompletionsUrl, draftReply, readLlmSettings } from "../src/index.ts";
import { tempDb } from "./helpers.ts";

const db = tempDb();
const booking = {
  channel: "web",
  from: "Ada Fernwood",
  text: "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE). Can we book Expedite on 26 November for 80 people? We are a community and we need food.",
  receivedAt: "2026-10-22T18:00:00.000Z",
  threadId: "llm-1",
};

after(() => {
  db.close();
});

test("no model settings means the rule-based path", async () => {
  assert.deepEqual(readLlmSettings({}), { enabled: false });
  assert.deepEqual(readLlmSettings({ LLM_API_KEY: "sk-test" }), { enabled: false });
  assert.equal(await draftReply({
    inbound: booking,
    ruleReply: "Thanks Ada.",
    env: {},
    fetchImpl: async () => {
      throw new Error("The model must not be called.");
    },
  }), null);
});

test("base url and model name select an OpenAI-compatible host", () => {
  assert.deepEqual(readLlmSettings({ LLM_BASE_URL: "http://127.0.0.1:11434/v1/", LLM_MODEL: "llama3.2" }), {
    enabled: true,
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: null,
    model: "llama3.2",
  });
  assert.equal(chatCompletionsUrl("https://api.openai.com/v1"), "https://api.openai.com/v1/chat/completions");
  assert.equal(chatCompletionsUrl("https://openrouter.ai/api/v1"), "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(chatCompletionsUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1/chat/completions");
  assert.equal(
    chatCompletionsUrl("https://example.test/v1/chat/completions"),
    "https://example.test/v1/chat/completions",
  );
});

test("a model can rewrite the draft and the draft still waits", async () => {
  let auth = "";
  let url = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    url = String(input);
    auth = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Thanks Ada. A person will confirm the price for 80 people on 26 November." } }],
    }));
  };
  const receipt = await acceptInbound(db, booking, {
    env: { LLM_BASE_URL: "https://api.openai.com/v1", LLM_API_KEY: "sk-test", LLM_MODEL: "gpt-4o-mini" },
    fetchImpl,
  });
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(auth, "Bearer sk-test");
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
  assert.match(receipt.outbox?.body ?? "", /confirm the price/);
});

test("a failed model call keeps the rule-based draft", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("offline");
  };
  const receipt = await acceptInbound(db, { ...booking, threadId: "llm-2" }, {
    env: { LLM_BASE_URL: "http://127.0.0.1:11434/v1", LLM_MODEL: "llama3.2" },
    fetchImpl,
  });
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
  assert.match(receipt.outbox?.body ?? "", /Thanks Ada/);
});
