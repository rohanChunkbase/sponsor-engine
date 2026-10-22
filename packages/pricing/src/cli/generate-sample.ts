import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { generateSampleBookings } from '../sample/generate.js';
import { SAMPLE_CSV_PATH } from '../paths.js';
import { bookingsToCsv } from '../serialize.js';

const bookings = generateSampleBookings();
mkdirSync(dirname(SAMPLE_CSV_PATH), { recursive: true });
writeFileSync(SAMPLE_CSV_PATH, bookingsToCsv(bookings), 'utf8');
process.stdout.write(`Wrote ${bookings.length} SAMPLE bookings to ${SAMPLE_CSV_PATH}\n`);
