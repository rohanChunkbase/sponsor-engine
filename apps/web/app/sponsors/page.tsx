import { PageIntro } from "@/components/shell";
import { findSponsors } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const params = await searchParams;
  const found = await findSponsors(await readyDb(), {
    request_id: params.request,
    limit: 5,
    log: false,
  });

  return (
    <>
      <PageIntro kicker="Sponsors" title="Who might pay for food">
        {found.live_note} Open a row for the source. Ask Raft to draft from here.
      </PageIntro>
      {!found.matches.length ? (
        <p className="text-[16px] text-raft-muted">No sponsor matched yet. Paste a booking in Ask Raft.</p>
      ) : (
        <ul className="flex max-w-[720px] flex-col gap-2">
          {found.matches.map((match) => (
            <li key={match.sponsor_id} className="rounded-2xl border border-raft-line bg-white/90 px-4 py-3">
              <p className="font-medium">{match.company}</p>
              <p className="mt-1 text-[14px] text-raft-muted">{match.reasons[0]}</p>
              {match.sources[0]?.url ? (
                <a className="mt-2 inline-block text-[13px] text-raft-chocolate underline" href={match.sources[0].url} target="_blank" rel="noreferrer">
                  Source
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
