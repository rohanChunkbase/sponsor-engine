export interface SmsRow {
  text: string;
  spam: boolean;
}

export interface SpamModel {
  version: 1;
  threshold: number;
  hamDocs: number;
  spamDocs: number;
  hamTokens: number;
  spamTokens: number;
  ham: Record<string, number>;
  spam: Record<string, number>;
}

export interface SpamVerdict {
  spam: boolean;
  score: number;
  reasons: string[];
}

export function trainNaiveBayes(rows: SmsRow[], threshold = 0.7): SpamModel {
  const ham: Record<string, number> = {};
  const spam: Record<string, number> = {};
  let hamDocs = 0;
  let spamDocs = 0;
  let hamTokens = 0;
  let spamTokens = 0;
  for (const row of rows) {
    const tokens = tokenize(row.text);
    const bag = row.spam ? spam : ham;
    if (row.spam) spamDocs += 1;
    else hamDocs += 1;
    for (const token of tokens) {
      bag[token] = (bag[token] ?? 0) + 1;
      if (row.spam) spamTokens += 1;
      else hamTokens += 1;
    }
  }
  return { version: 1, threshold, hamDocs, spamDocs, hamTokens, spamTokens, ham, spam };
}

export function classifyText(text: string, model: SpamModel): SpamVerdict {
  const tokens = tokenize(text);
  const vocab = new Set([...Object.keys(model.ham), ...Object.keys(model.spam)]).size || 1;
  const hamDenom = model.hamTokens + vocab;
  const spamDenom = model.spamTokens + vocab;
  let logOdds = Math.log((model.spamDocs + 1) / (model.hamDocs + 1));
  const ranked: Array<{ token: string; weight: number }> = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const spamCount = model.spam[token] ?? 0;
    const hamCount = model.ham[token] ?? 0;
    if (spamCount === 0 && hamCount === 0) continue;
    const spamProb = (spamCount + 1) / spamDenom;
    const hamProb = (hamCount + 1) / hamDenom;
    const weight = Math.log(spamProb) - Math.log(hamProb);
    logOdds += weight;
    if (!seen.has(token)) {
      seen.add(token);
      ranked.push({ token, weight });
    }
  }
  const score = 1 / (1 + Math.exp(-logOdds));
  const reasons = ranked
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((item) => item.token);
  return {
    spam: score >= model.threshold,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}
