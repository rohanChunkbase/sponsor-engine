import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(appDir, "../..");

const traced = [
  "../../package.json",
  "../../packages/db/src/schema.sql",
  "../../packages/db/src/schema.postgres.sql",
  "../../packages/db/src/pg-worker.mjs",
  "../../packages/pricing/dist/**/*",
  "../../packages/pricing/data/**/*",
  "../../packages/integrations/dist/**/*",
  "../../packages/integrations/seed/**/*",
  "../../data/real-data/**/*",
  "../../data/synthetic-data/**/*",
  "../../data/**/*.csv",
  "../../data/**/*.json",
  "../../packages/*/data/**/*",
  "../../packages/*/seed/**/*",
  "../../packages/**/*.csv",
  "../../packages/*/package.json",
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": traced,
    "/api/**/*": traced,
  },
  transpilePackages: ["@sponsor-engine/brand", "@sponsor-engine/channels", "@sponsor-engine/core", "@sponsor-engine/db", "@sponsor-engine/mcp"],
  serverExternalPackages: ["better-sqlite3", "postgres", "@sponsor-engine/pricing", "@modelcontextprotocol/sdk", "discord.js", "@slack/bolt"],
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    if (isServer) {
      const external = "better-sqlite3";
      const current = config.externals;
      if (Array.isArray(current)) current.push(external);
      else config.externals = [current, external].filter(Boolean);
    }
    return config;
  },
};

export default nextConfig;
