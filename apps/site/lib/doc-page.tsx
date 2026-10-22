import type { ComponentType } from "react";
import BringYourOwn, { frontmatter as bringYourOwnMeta } from "../../../docs/bring-your-own.mdx";
import Channels, { frontmatter as channelsMeta } from "../../../docs/channels.mdx";
import Connect, { frontmatter as connectMeta } from "../../../docs/connect.mdx";
import Data, { frontmatter as dataMeta } from "../../../docs/data.mdx";
import Pricing, { frontmatter as pricingMeta } from "../../../docs/pricing.mdx";
import Quickstart, { frontmatter as quickstartMeta } from "../../../docs/quickstart.mdx";
import Safety, { frontmatter as safetyMeta } from "../../../docs/safety.mdx";
import SelfHost, { frontmatter as selfHostMeta } from "../../../docs/self-host.mdx";
import Tools, { frontmatter as toolsMeta } from "../../../docs/tools.mdx";
import config from "../../../docs/docs.json";

export type DocPage = {
  Content: ComponentType;
  title: string;
  description?: string;
};

function page(Content: ComponentType, meta: { title?: string; description?: string }): DocPage {
  const doc: DocPage = { Content, title: meta.title ?? "Docs" };
  if (meta.description) doc.description = meta.description;
  return doc;
}

export const docs: Record<string, DocPage> = {
  quickstart: page(Quickstart, quickstartMeta),
  connect: page(Connect, connectMeta),
  tools: page(Tools, toolsMeta),
  channels: page(Channels, channelsMeta),
  "bring-your-own": page(BringYourOwn, bringYourOwnMeta),
  safety: page(Safety, safetyMeta),
  "self-host": page(SelfHost, selfHostMeta),
  pricing: page(Pricing, pricingMeta),
  data: page(Data, dataMeta),
};

export function hrefForDoc(slug: string) {
  return slug === "quickstart" ? "/docs" : `/docs/${slug}`;
}

export const docsNav = config.navigation.groups.map((group) => ({
  label: group.group,
  pages: group.pages.map((slug) => ({
    href: hrefForDoc(slug),
    label: docs[slug]?.title ?? slug,
  })),
}));
