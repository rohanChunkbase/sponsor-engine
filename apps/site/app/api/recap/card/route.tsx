import { cardSpecFromSearchParams } from "@sponsor-engine/recap";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";
import React from "react";
import { RecapCardArt } from "../../../../lib/recap-card-art";
import { loadRecapFonts } from "../../../../lib/recap-fonts";

function raftMarkSrc() {
  const candidates = [
    resolve("packages/brand/assets/raft-mark.png"),
    resolve("../../packages/brand/assets/raft-mark.png"),
    resolve("public/brand/raft-mark.png"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return undefined;
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spec = cardSpecFromSearchParams(new URL(request.url).searchParams);
  if (!spec) {
    return new Response("This recap card does not exist.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const fonts = await loadRecapFonts();
  return new ImageResponse(<RecapCardArt spec={spec} markSrc={raftMarkSrc()} />, {
    width: spec.width,
    height: spec.height,
    fonts,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
