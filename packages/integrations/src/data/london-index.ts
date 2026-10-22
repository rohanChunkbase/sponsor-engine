import type { ResolvedOptions } from "../options.ts";
import { builtinResult, errorText, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";
import {
  bundledLondonEvents,
  indexFromEvents,
  type LondonEvent,
  type LondonEventsIndex,
  type SourcePull,
} from "./london.ts";
import { pullLumaLondon } from "./luma-discover.ts";
import { fetchMlhEvents } from "./mlh.ts";
import { fetchBuilderBaseEvents } from "./organisers.ts";
import { fetchEventbriteEvents } from "./eventbrite.ts";
import { fetchMeetupEvents } from "./meetup.ts";

export interface LondonIndexData extends LondonEventsIndex {
  sources: SourcePull[];
}

export async function buildLondonEventsIndex(options: ResolvedOptions): Promise<ProviderResult<LondonIndexData>> {
  const bundled = bundledLondonEvents(options.seedDir);
  if (options.offline) {
    const data = finish([{ id: "bundled-data", mode: "builtin", events: bundled }], bundled);
    return builtinResult("bundled-data", data);
  }
  const pulls: SourcePull[] = [];
  try {
    const luma = await pullLumaLondon(options);
    pulls.push({
      id: "luma-discover",
      mode: "live",
      events: luma.events.filter((event) => event.source === "luma-discover"),
      warning: luma.icsWarning,
    });
    const ics = luma.events.filter((event) => event.source === "luma-ics");
    pulls.push({
      id: "luma-ics",
      mode: luma.icsMode,
      events: ics,
      warning: luma.icsWarning,
    });
  } catch (error) {
    pulls.push({
      id: "luma-discover",
      mode: "builtin",
      events: [],
      warning: `Luma discover did not respond (${errorText(error)}). Bundled data was used.`,
    });
  }
  pulls.push(await caughtPull("meetup", "Meetup", () => fetchMeetupEvents(options)));
  pulls.push(await caughtPull("eventbrite", "Eventbrite", () => fetchEventbriteEvents(options)));
  pulls.push(await caughtPull("builderbase", "BuilderBase", () => fetchBuilderBaseEvents(options)));
  pulls.push(await caughtPull("mlh", "MLH", () => fetchMlhEvents(options)));
  const liveEvents = pulls.flatMap((pull) => pull.events);
  const useBundle = liveEvents.length === 0;
  if (useBundle) pulls.push({ id: "bundled-data", mode: "builtin", events: bundled });
  const data = finish(pulls, useBundle ? bundled : liveEvents);
  const warning = pulls.map((pull) => pull.warning).filter(Boolean).join(" ") || undefined;
  if (liveEvents.length === 0) return builtinResult("bundled-data", data, warning);
  return liveResult("london-events", data, { warning });
}

function finish(sources: SourcePull[], events: LondonEvent[]): LondonIndexData {
  return { ...indexFromEvents(events), sources };
}

export async function caughtPull(
  id: string,
  label: string,
  load: () => Promise<LondonEvent[]>,
): Promise<SourcePull> {
  try {
    return { id, mode: "live", events: await load() };
  } catch (error) {
    return {
      id,
      mode: "builtin",
      events: [],
      warning: `${label} did not respond (${errorText(error)}).`,
    };
  }
}
