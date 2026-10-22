import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sponsor-engine/channels", "@sponsor-engine/core", "@sponsor-engine/db"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
