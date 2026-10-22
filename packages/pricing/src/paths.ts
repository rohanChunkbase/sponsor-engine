import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Directory that contains package.json. Works from src and from dist. */
export const PACKAGE_ROOT = join(here, '..');

/**
 * import.meta.url is baked in at build time on Vercel (/vercel/path0), while the
 * traced files live under /var/task at runtime, so try runtime-relative paths first.
 */
export function resolveDataFile(file: string, envName?: string): string {
  const candidates = [
    envName ? process.env[envName] : undefined,
    join(process.cwd(), '..', '..', 'packages', 'pricing', 'data', file),
    join(process.cwd(), 'packages', 'pricing', 'data', file),
    join(PACKAGE_ROOT, 'data', file),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(candidate)) ?? join(PACKAGE_ROOT, 'data', file);
}

export const SAMPLE_CSV_PATH = resolveDataFile('sample-bookings.csv', 'SPONSOR_ENGINE_VENUE_CSV');

/** Public London venue hire prices. Not SAMPLE data. */
export const LONDON_MARKET_CSV_PATH = resolveDataFile('london_venue_market.csv', 'SPONSOR_ENGINE_MARKET_CSV');
