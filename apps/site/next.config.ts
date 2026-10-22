import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkDocsLinks from "./lib/remark-docs-links.mjs";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@sponsor-engine/recap", "@sponsor-engine/brand"],
  async redirects() {
    return [
      { source: "/docs/integrations", destination: "/docs/bring-your-own", permanent: false },
      { source: "/docs/deploy", destination: "/docs/self-host", permanent: false },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkDocsLinks],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
