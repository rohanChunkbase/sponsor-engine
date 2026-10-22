"use client";

import { useState } from "react";

export function CopyBlock({
  code,
  label,
  tone = "paper",
}: {
  code: string;
  label?: string;
  tone?: "paper" | "ink";
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={tone === "ink" ? "copy-block copy-block-ink" : "copy-block"}>
      <div className="copy-bar">
        {label ? <span className="copy-label">{label}</span> : <span />}
        <button type="button" className="btn-text" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
