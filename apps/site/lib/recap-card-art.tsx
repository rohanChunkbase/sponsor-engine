import type { CardSpec } from "@sponsor-engine/recap";
import React from "react";

/** Glow card drawn with the CSS subset satori supports. */
export function RecapCardArt({ spec }: { spec: CardSpec }) {
  const portrait = spec.format === "portrait";
  const title = portrait ? 76 : 58;
  const line = portrait ? 40 : 32;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundImage: "linear-gradient(145deg, #2a0a4a 0%, #6d28d9 42%, #0e7490 100%)",
        padding: portrait ? 48 : 36,
        fontFamily: "Inter",
        color: "#f8f5ff",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: portrait ? -80 : -120,
          left: portrait ? -40 : -60,
          width: portrait ? 520 : 460,
          height: portrait ? 520 : 460,
          borderRadius: 999,
          backgroundImage: "radial-gradient(circle, rgba(255,92,180,0.95) 0%, rgba(255,92,180,0) 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: portrait ? -80 : -40,
          bottom: portrait ? 80 : -140,
          width: portrait ? 560 : 500,
          height: portrait ? 560 : 500,
          borderRadius: 999,
          backgroundImage: "radial-gradient(circle, rgba(56,210,255,0.9) 0%, rgba(56,210,255,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: portrait ? 280 : 40,
          right: portrait ? 80 : 160,
          width: 280,
          height: 280,
          borderRadius: 999,
          backgroundImage: "radial-gradient(circle, rgba(250,204,21,0.75) 0%, rgba(250,204,21,0) 70%)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          borderRadius: portrait ? 72 : 48,
          border: "2px solid rgba(255,255,255,0.5)",
          backgroundColor: "rgba(255,255,255,0.14)",
          padding: portrait ? 56 : 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 36,
                padding: "0 14px",
                borderRadius: 999,
                backgroundColor: spec.example ? "rgba(255,214,120,0.92)" : "rgba(255,255,255,0.2)",
                color: spec.example ? "#4a2a08" : "#f8f5ff",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 1.4,
              }}
            >
              {spec.kicker}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: portrait ? 36 : 22,
              fontSize: title,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1.2,
            }}
          >
            {spec.heading}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: portrait ? 28 : 16 }}>
            {spec.lines.map((lineText) => (
              <div key={lineText} style={{ display: "flex", fontSize: line, lineHeight: 1.25, marginTop: 8 }}>
                {lineText}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: portrait ? 28 : 22, color: "rgba(248,245,255,0.86)" }}>{spec.footer}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
            <OtterMark />
            <div style={{ display: "flex", marginLeft: 12, fontSize: 20 }}>made with Sponsor Engine</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OtterMark() {
  return (
    <div style={{ display: "flex", width: 42, height: 42, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 2,
          top: 0,
          width: 14,
          height: 14,
          borderRadius: 8,
          backgroundColor: "#4a2912",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 2,
          top: 0,
          width: 14,
          height: 14,
          borderRadius: 8,
          backgroundColor: "#4a2912",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 3,
          top: 8,
          width: 36,
          height: 30,
          borderRadius: 18,
          backgroundColor: "#6b3a1f",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 10,
          top: 18,
          width: 22,
          height: 14,
          borderRadius: 10,
          backgroundColor: "#f3e2cf",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 20,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: "#2b1810",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 14,
          top: 20,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: "#2b1810",
        }}
      />
    </div>
  );
}
