import { PageIntro } from "@/components/shell";
import { EXPEDITE_EXAMPLE } from "@sponsor-engine/recap";

export default function RecapPage() {
  const recap = EXPEDITE_EXAMPLE;
  return (
    <>
      <PageIntro kicker="Recap" title={recap.eventName}>
        Example recap only. A person names winners. Raft does not post.
      </PageIntro>
      <p className="text-[16px] text-raft-muted">
        {recap.date} · {recap.venue} · {recap.attendeeCount} people
      </p>
      <ul className="max-w-[560px] space-y-2">
        {recap.winners.map((winner) => (
          <li key={winner.place} className="rounded-2xl border border-raft-line bg-white/90 px-4 py-3">
            <p className="text-[13px] text-raft-muted">{winner.place}</p>
            <p className="font-medium">{winner.team}</p>
            <p className="text-[14px] text-raft-muted">{winner.project}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
