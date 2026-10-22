"use client";

import { useEffect, useId, useState } from "react";

export function Mermaid({ chart }: { chart: string }) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function draw() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "Geist, Inter Tight, sans-serif",
          themeVariables: {
            background: "#F7F8FA",
            primaryColor: "#EDF2FF",
            primaryTextColor: "#121316",
            primaryBorderColor: "#1F5EFF",
            secondaryColor: "#F7F8FA",
            tertiaryColor: "#FFFFFF",
            lineColor: "#5E6269",
            textColor: "#121316",
            fontSize: "16px",
          },
        });
        const rendered = await mermaid.render(`outbox-${reactId}`, chart);
        if (!cancel) setSvg(rendered.svg);
      } catch {
        if (!cancel) setFailed(true);
      }
    }
    void draw();
    return () => {
      cancel = true;
    };
  }, [chart, reactId]);

  if (failed || !svg) {
    return (
      <pre className="mermaid-frame">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      className="mermaid-frame"
      role="img"
      aria-label="Outbox state machine"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
