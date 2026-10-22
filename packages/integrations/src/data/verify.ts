import type { ResolvedOptions } from "../options.ts";
import { builtinResult, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";
import { devpostProjects, type DevpostProject } from "./devpost-projects.ts";
import { githubProfile, type GithubProfile } from "./github.ts";
import { hackerNewsStories, type HackerNewsStory } from "./hackernews.ts";

export interface RequesterSignal {
  handle: string;
  realBuilder: boolean;
  score: number;
  reasons: string[];
  github: GithubProfile | null;
  devpostProjects: DevpostProject[];
  hackerNews: HackerNewsStory[];
}

export function scoreRequester(input: {
  handle: string;
  github: GithubProfile | null;
  devpostProjects: DevpostProject[];
  hackerNews: HackerNewsStory[];
}): RequesterSignal {
  let score = 0;
  const reasons: string[] = [];
  const age = input.github?.found ? input.github.accountAgeDays : null;
  const repos = input.github?.found ? input.github.publicRepos : null;
  const followers = input.github?.found ? input.github.followers : null;
  if (age !== null && age >= 365) {
    score += 0.35;
    reasons.push("GitHub account is at least one year old.");
  } else if (age !== null && age >= 90) {
    score += 0.2;
    reasons.push("GitHub account is at least 90 days old.");
  }
  if (repos !== null && repos >= 1) {
    score += 0.25;
    reasons.push("GitHub has public repositories.");
  }
  if (repos !== null && repos >= 5) {
    score += 0.1;
    reasons.push("GitHub has at least five public repositories.");
  }
  if (followers !== null && followers >= 5) {
    score += 0.15;
    reasons.push("GitHub has at least five followers.");
  }
  if (input.devpostProjects.length > 0) {
    score += 0.25;
    reasons.push("Devpost lists a project for this handle.");
  }
  if (input.devpostProjects.some((project) => project.winner)) {
    score += 0.1;
    reasons.push("A Devpost project is marked as a winner.");
  }
  if (input.hackerNews.length > 0) {
    score += 0.15;
    reasons.push("Hacker News has a story by this handle.");
  }
  const capped = Math.min(1, Math.round(score * 1000) / 1000);
  return {
    handle: input.handle,
    realBuilder: capped >= 0.35,
    score: capped,
    reasons,
    github: input.github,
    devpostProjects: input.devpostProjects,
    hackerNews: input.hackerNews,
  };
}

export function emptyRequester(handle: string): RequesterSignal {
  return scoreRequester({ handle, github: null, devpostProjects: [], hackerNews: [] });
}

export async function verifyRequester(
  handle: string,
  options: ResolvedOptions,
): Promise<ProviderResult<RequesterSignal>> {
  const name = handle.trim().replace(/^@/, "");
  if (!name) return builtinResult("bundled-data", emptyRequester(handle), "A handle is required.");
  if (options.offline) {
    return builtinResult("bundled-data", emptyRequester(name), "Live calls are off. The builder check was skipped.");
  }
  const [github, projects, stories] = await Promise.all([
    githubProfile(name, options),
    devpostProjects(name, options),
    hackerNewsStories(name, options),
  ]);
  const signal = scoreRequester({
    handle: name,
    github: github.mode === "live" ? github.data : null,
    devpostProjects: projects.mode === "live" ? projects.data : [],
    hackerNews: stories.mode === "live" ? stories.data : [],
  });
  const warning = [github.warning, projects.warning, stories.warning].filter(Boolean).join(" ") || undefined;
  const live = [github, projects, stories].some((result) => result.mode === "live");
  if (!live) return builtinResult("bundled-data", signal, warning);
  return liveResult("verify-requester", signal, { warning });
}
