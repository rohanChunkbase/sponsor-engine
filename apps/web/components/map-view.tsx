"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export type MapPoint = {
  id: string;
  title: string;
  date: string | null;
  lat: number;
  lon: number;
  community_name: string | null;
  area: string | null;
  venue: string | null;
  is_sample: string | null;
};

export function MapView({ points }: { points: MapPoint[] }) {
  const node = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!node.current) return;
    const map = new maplibregl.Map({
      container: node.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-0.12, 51.51],
      zoom: 10.5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    for (const point of points) {
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<strong>${escapeHtml(point.title)}</strong><br/>${escapeHtml(point.community_name || "")}<br/>${escapeHtml(point.date || "")} ${escapeHtml(point.area || point.venue || "")}`,
      );
      new maplibregl.Marker({ color: point.is_sample === "SAMPLE" ? "#B86B16" : "#1F5EFF" })
        .setLngLat([point.lon, point.lat])
        .setPopup(popup)
        .addTo(map);
    }
    return () => map.remove();
  }, [points]);

  return <div ref={node} className="h-[640px] w-full rounded-[12px] border border-border" />;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
