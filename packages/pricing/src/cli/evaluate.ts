import { EXAMPLE_REQUESTS } from '../examples.js';
import { evaluatePricing } from '../evaluate.js';
import { loadBookingsFile } from '../load.js';
import { formatGbp } from '../money.js';
import { SAMPLE_CSV_PATH } from '../paths.js';
import { quotePrice } from '../quote.js';
import { summarizeHistory } from '../stats.js';
import type { ModelScore } from '../evaluate.js';
import type { Quote } from '../types.js';

function money(value: number): string {
  return `£${value.toFixed(2)}`;
}

function mape(value: number): string {
  if (Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(1)}%`;
}

function printScore(label: string, score: ModelScore): void {
  process.stdout.write(
    `${label}\n  MAE ${money(score.maeGbp)}   MAPE ${mape(score.mapePercent)} on ${score.paidRows} paid rows\n  Free slots predicted as £0: ${score.freeSlotsCorrect} of ${score.freeSlotRows}\n  Paid rows predicted as £0: ${score.paidPredictedFree}\n  ${score.detail}\n`,
  );
}

function printQuote(title: string, quote: Quote): void {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(`Price: ${formatGbp(quote.price)}\n`);
  process.stdout.write(`Currency: ${quote.currency}\n`);
  process.stdout.write(`Range: ${formatGbp(quote.range.low)} to ${formatGbp(quote.range.high)}\n`);
  process.stdout.write(
    `Market: percentile ${quote.market.percentile} of ${quote.market.comparedCount} similar London rooms. Nearest published band ${formatGbp(quote.market.low)} to ${formatGbp(quote.market.high)}.\n`,
  );
  for (const room of quote.market.nearest) {
    process.stdout.write(
      `  ${room.name}  ${formatGbp(room.price)}  capacity ${room.capacity}  ${room.url}\n`,
    );
  }
  process.stdout.write(`Explanation:\n${quote.explanation}\n`);
  process.stdout.write('Comparables:\n');
  for (const row of quote.comparables) {
    const slot = `${row.isWeekend ? 'weekend' : 'weekday'} ${row.isEvening ? 'evening' : 'day'}`;
    process.stdout.write(
      `  ${row.bookingId}  ${row.date}  ${row.bookerType}  ${row.headcount} people  ${row.hours}h  ${slot}  ${formatGbp(row.pricePaidGbp)}  distance ${row.distance.toFixed(2)}\n`,
    );
  }
}

const started = Date.now();
const history = loadBookingsFile(SAMPLE_CSV_PATH);
const summary = summarizeHistory(history);
const report = evaluatePricing(history);

process.stdout.write('SAMPLE venue booking history\n');
process.stdout.write('This data is fictional. Do not use these prices for a real venue.\n\n');
process.stdout.write(`Rows: ${summary.count}. Free community slots: ${summary.freeSlots}.\n`);
for (const bookerType of ['community', 'startup', 'agency', 'company'] as const) {
  const segment = summary.byType[bookerType];
  process.stdout.write(
    `  ${bookerType}: ${segment.count} bookings, median ${formatGbp(segment.medianGbp ?? 0)}, paid median ${segment.paidMedianGbp === null ? 'n/a' : formatGbp(segment.paidMedianGbp)}, free slots ${segment.freeSlots}\n`,
  );
}

process.stdout.write('\nHeld-out evaluation\n');
process.stdout.write(
  `Split: first ${report.trainCount} bookings by date for the fit. Last ${report.testCount} bookings for the score.\n`,
);
process.stdout.write(`${report.selectionRule}\n\n`);
for (const score of report.scores) {
  const mark = score.model === report.winner ? ' (winner)' : '';
  printScore(`${score.model}${mark}`, score);
  process.stdout.write('\n');
}
printScore('median baseline (not used for quotes)', report.baselineMedian);

process.stdout.write(
  '\nExample quotes\nThe fit for these quotes uses the full SAMPLE history and the winning method.\nThese three requests are not in the history.\nThe MAE and the MAPE above do not use these three quotes.\n',
);

for (const example of EXAMPLE_REQUESTS) {
  printQuote(example.title, quotePrice(example.request, history));
}

process.stdout.write(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
