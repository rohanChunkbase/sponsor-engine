import type { MapPoint } from "@/components/map-view";
import { LondonMap } from "@/components/london-map";
import { PageIntro } from "@/components/shell";
import { getReadyDb, mapPoints } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default function MapPage() {
  const points = mapPoints(getReadyDb());
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
