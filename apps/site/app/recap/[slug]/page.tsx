import { RecapCarousel } from "@/components/recap-carousel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cardPath, formatRecapDate, getRecap, shareOnLinkedIn, shareOnX } from "@sponsor-engine/recap";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ card?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const recap = getRecap(slug);
  if (!recap) return { title: "Recap" };
  const card = recap.cards.find((item) => item.id === query.card) ?? recap.cards.find((item) => item.kind === "summary");
  const title = recap.example ? `EXAMPLE · ${recap.eventName}` : recap.eventName;
  const description = card?.caption ?? recap.eventName;
  const image = card ? `${await siteOrigin()}${cardPath(slug, card, "landscape")}` : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image, width: 1200, height: 630 }] : [],
    },
  };
}

export default async function RecapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recap = getRecap(slug);
  if (!recap) notFound();
  const origin = await siteOrigin();
  const cards = recap.cards.map((card) => {
    const pageUrl = `${origin}/recap/${slug}?card=${encodeURIComponent(card.id)}`;
    return {
      id: card.id,
      heading: card.heading,
      caption: card.caption,
      image: cardPath(slug, card, "landscape"),
      portrait: cardPath(slug, card, "portrait"),
      shareX: shareOnX(pageUrl, card.caption),
      shareLinkedIn: shareOnLinkedIn(pageUrl),
    };
  });

  return (
    <>
      <SiteHeader />
      <main id="content" className="recap-page">
        <div className="wrap">
          <p className="eyebrow">{recap.example ? "Example" : formatRecapDate(recap.date)}</p>
          <h1>{recap.eventName}</h1>
          {recap.example ? (
            <p className="lede">This recap is an example. The winners are placeholders. They are not the result of the night.</p>
          ) : (
            <p className="lede">Share a card from the night. You post it yourself.</p>
          )}
          <p className="lede">
            {formatRecapDate(recap.date)} · {recap.venue}
            {recap.attendeeCount !== undefined ? ` · ${recap.attendeeCount} people` : ""}. You post each card yourself. Sponsor Engine does not post it.
          </p>
        </div>
        <RecapCarousel cards={cards} />
      </main>
      <SiteFooter />
    </>
  );
}
