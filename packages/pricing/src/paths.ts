import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Directory that contains package.json. Works from src and from dist. */
export const PACKAGE_ROOT = join(here, '..');

export const SAMPLE_CSV_PATH = join(PACKAGE_ROOT, 'data', 'sample-bookings.csv');

/** Public London venue hire prices. Not SAMPLE data. */
export const LONDON_MARKET_CSV_PATH = join(PACKAGE_ROOT, 'data', 'london_venue_market.csv');
