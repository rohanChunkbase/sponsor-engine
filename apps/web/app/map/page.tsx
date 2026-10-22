import type { MapPoint } from "@/components/map-view";
import { LondonMap } from "@/components/london-map";
import { PageIntro } from "@/components/shell";
import { mapPoints } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const points = mapPoints(await readyDb());
  return (
    <>
      <PageIntro kicker="Map" title="London events">
        Blue marks a public event. Amber marks sample data. The map uses free tiles. No key is required.
      </PageIntro>
      <LondonMap points={points as unknown as MapPoint[]} />
      <p className="text-[16px] leading-6 text-muted-foreground">{points.length} events have a public location.</p>
    </>
  );
}
