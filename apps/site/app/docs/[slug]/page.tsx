import { docs } from "@/lib/doc-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return Object.keys(docs)
    .filter((slug) => slug !== "quickstart")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc) return { title: "Docs" };
  return { title: doc.title, description: doc.description };
}

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc) notFound();
  const Content = doc.Content;
  return (
    <>
      <h1>{doc.title}</h1>
      {doc.description ? <p className="lede">{doc.description}</p> : null}
      <Content />
    </>
  );
}
