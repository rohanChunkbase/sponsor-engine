import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPEDITE_EXAMPLE } from "@sponsor-engine/recap";
import { GET } from "../app/api/recap/card/route.tsx";

function cardUrl(kind: string, format: string, index = 0) {
  const params = new URLSearchParams({
    slug: EXPEDITE_EXAMPLE.slug,
    kind,
    index: String(index),
    format,
  });
  return `http://127.0.0.1:3001/api/recap/card?${params.toString()}`;
}

async function png(url: string) {
  const response = await GET(new Request(url));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("a winner card is a 1200 by 630 PNG", async () => {
  const size = await png(cardUrl("winner", "landscape", 0));
  assert.deepEqual(size, { width: 1200, height: 630 });
});

test("the portrait summary card is 1080 by 1350", async () => {
  const size = await png(cardUrl("summary", "portrait"));
  assert.deepEqual(size, { width: 1080, height: 1350 });
});

test("the sponsor card renders in both sizes", async () => {
  const landscape = await png(cardUrl("sponsors", "landscape"));
  const portrait = await png(cardUrl("sponsors", "portrait"));
  assert.deepEqual(landscape, { width: 1200, height: 630 });
  assert.deepEqual(portrait, { width: 1080, height: 1350 });
});

test("an unknown recap is refused", async () => {
  const response = await GET(new Request("http://127.0.0.1:3001/api/recap/card?slug=missing&kind=summary&format=landscape"));
  assert.equal(response.status, 400);
  assert.match(await response.text(), /does not exist/);
});
