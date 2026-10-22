import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sponsor-engine/core", "@sponsor-engine/db", "@sponsor-engine/brand"],
  serverExternalPackages: ["better-sqlite3", "@sponsor-engine/pricing"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
