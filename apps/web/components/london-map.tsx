"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/map-view";

const MapView = dynamic(() => import("@/components/map-view").then((mod) => mod.MapView), { ssr: false });

export function LondonMap({ points }: { points: MapPoint[] }) {
  return <MapView points={points} />;
}
