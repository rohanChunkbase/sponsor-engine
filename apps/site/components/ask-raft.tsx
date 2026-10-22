"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { AsciiOtter, type AsciiOtterFrame } from "@/components/ascii-otter";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { unicornMafiaReplay, type RaftReplay } from "@/lib/raft-replay";

type AskRaftProps = {
  title?: string;
  replay?: RaftReplay;
  liveHref?: string;
};

function isUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

export function AskRaft({ title = "Ask Raft", replay = unicornMafiaReplay, liveHref = "/mcp" }: AskRaftProps) {
  const headingId = useId();
  const inputId = useId();
  const [reduce, setReduce] = useState(false);
  const [run, setRun] = useState(0);
  const [typed, setTyped] = useState(0);
  const [shownBeats, setShownBeats] = useState(0);
  const [phase, setPhase] = useState<"type" | "tools" | "done">("type");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [blink, setBlink] = useState(false);
  const [breath, setBreath] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduce) {
      setTyped(replay.message.length);
      setShownBeats(replay.beats.length);
      setPhase("done");
      return;
    }

    let cancel = false;
    const timers: number[] = [];
    const later = (ms: number, next: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancel) next();
        }, ms),
      );
    };

    setTyped(0);
    setShownBeats(0);
    setPhase("type");
    setDraft("");
    setNote("");

    const typeAt = (index: number) => {
      later(index === 0 ? 700 : 34, () => {
        setTyped(index + 1);
        if (index + 1 < replay.message.length) {
          typeAt(index + 1);
          return;
        }
        setPhase("tools");
        replay.beats.forEach((_, beat) => {
          later(420 + beat * 680, () => {
            setShownBeats(beat + 1);
            if (beat + 1 === replay.beats.length) setPhase("done");
          });
        });
      });
    };

    typeAt(0);

    return () => {
      cancel = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [reduce, replay, run]);

  useEffect(() => {
    if (reduce) return;
    const breathId = window.setInterval(() => setBreath((value) => !value), 1700);
    const blinkId = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 3400);
    return () => {
      window.clearInterval(breathId);
      window.clearInterval(blinkId);
    };
  }, [reduce]);

  const listening = draft.length > 0 || (!reduce && phase === "type");
  let frame: AsciiOtterFrame = "open";
  if (listening) frame = blink ? "blink" : "listen";
  else if (phase === "done") frame = blink ? "blink" : "pleased";
  else if (blink) frame = "blink";
  else if (breath) frame = "breath";

  const fieldValue = !reduce && phase === "type" ? replay.message.slice(0, typed) : draft;
  const requestVisible = reduce || phase !== "type";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || phase !== "done") return;
    setNote(replay.cannedReply);
    setDraft("");
  };

  return (
    <section className="ask-raft" aria-labelledby={headingId}>
      <header className="ask-raft-bar">
        <span className="ask-raft-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h2 id={headingId}>{title}</h2>
        <span className="badge badge-open">
          <i />
          Test mode
        </span>
      </header>
      <div className="ask-raft-body">
        <AsciiOtter frame={frame} label="Raft" />
        <div className="ask-raft-log" role="log" aria-live="polite" aria-relevant="additions">
          {requestVisible ? (
            <article>
              <p className="ask-kicker">
                {replay.channel} · {replay.sender}
              </p>
              <p>{replay.message}</p>
            </article>
          ) : null}
          {replay.beats.slice(0, shownBeats).map((beat) => (
            <article key={beat.tool}>
              <p className="ask-kicker">{beat.tool}</p>
              <dl>
                {beat.rows.map((row) => (
                  <div className="ask-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{isUrl(row.value) ? <a href={row.value}>{row.value}</a> : row.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          {phase === "done" ? (
            <p className="badge badge-open">
              <i />
              {replay.status}
            </p>
          ) : null}
          {note ? <p className="ask-note">{note}</p> : null}
        </div>
      </div>
      <form className="ask-raft-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          Message to Raft
        </label>
        <input
          id={inputId}
          value={fieldValue}
          readOnly={phase !== "done"}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={phase === "done" ? "Type to Raft" : "Raft is reading the ask"}
          autoComplete="off"
        />
        <button
          className="ask-replay"
          type="button"
          onClick={() => {
            setDraft("");
            setNote("");
            setRun((value) => value + 1);
          }}
        >
          Replay
        </button>
        <ShimmerButton href={liveHref} className="btn-paper">
          Try it live
        </ShimmerButton>
      </form>
      <p className="ask-caption">{replay.caption}</p>
    </section>
  );
}
