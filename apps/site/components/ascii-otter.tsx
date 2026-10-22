import { asciiOtterFrames, type AsciiOtterFrame } from "@/lib/ascii-otter-frames";

export type { AsciiOtterFrame };

type AsciiOtterProps = {
  frame?: AsciiOtterFrame;
  label?: string;
};

/** Monospace otter. Pass a frame name. The parent decides when the frame changes. */
export function AsciiOtter({ frame = "open", label = "Raft" }: AsciiOtterProps) {
  return (
    <pre className="ascii-otter" aria-hidden="true" data-label={label}>
      {asciiOtterFrames[frame].join("\n")}
    </pre>
  );
}
