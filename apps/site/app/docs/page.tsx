import { docs } from "@/lib/doc-page";

const doc = docs.quickstart;

export const metadata = {
  title: doc.title,
  description: doc.description,
};

export default function QuickstartPage() {
  const Content = doc.Content;
  return (
    <>
      <h1>{doc.title}</h1>
      {doc.description ? <p className="lede">{doc.description}</p> : null}
      <Content />
    </>
  );
}
