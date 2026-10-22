import { formatGbp } from './money.js';
import { summarizeHistory } from './stats.js';
import type { EvaluationReport } from './evaluate.js';
import type { BookerType, Booking, Comparable, PriceRange, QuoteRequest } from './types.js';
import type { ModelName } from './types.js';

export interface ExplanationInput {
  request: QuoteRequest;
  history: readonly Booking[];
  price: number;
  range: PriceRange;
  comparables: readonly Comparable[];
  modelName: ModelName;
  report: EvaluationReport;
  knnPrice: number;
  gbdtPrice: number;
  freeRule: boolean;
  /** One sentence that places the quote against published London rooms. */
  marketLine: string;
}

function gbp(amount: number | null): string {
  if (amount === null) return 'n/a';
  return formatGbp(amount);
}

function percent(value: number): string {
  if (Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(1)}%`;
}

function score(report: EvaluationReport, model: ModelName) {
  const found = report.scores.find((row) => row.model === model);
  if (!found) throw new Error(`The report has no score for ${model}.`);
  return found;
}

function when(request: QuoteRequest): string {
  const day = request.isWeekend ? 'The booking is on a weekend.' : 'The booking is on a weekday.';
  const part = request.isEvening ? 'The booking is an evening.' : 'The booking is in the day.';
  return `${day} ${part}`;
}

function discountParagraph(request: QuoteRequest, price: number, freeRule: boolean): string {
  if (request.bookerType === 'community' && price === 0) {
    const reason = freeRule
      ? 'At least half of the nearest community bookings were free slots.'
      : 'The price from the history is £0.';
    return `The community discount is a free slot. ${reason} Communities book often and bring leads, so a community can pay less than a company or pay nothing.`;
  }
  if (request.bookerType === 'community') {
    return 'The community discount is already in the price. The price is lower than a company price for this shape of booking. This slot is not free. A company pays the full price.';
  }
  if (request.bookerType === 'startup') {
    return 'There is no community discount on this quote and the slot is not free. A startup pays a middle price. A community pays less. A company pays the full price.';
  }
  if (request.bookerType === 'agency') {
    return 'There is no community discount on this quote. An agency pays a commercial price. A community pays less. A company pays more.';
  }
  return 'There is no community discount on this quote. A company books rarely and pays the full price. A community that brings leads can pay much less, or pay nothing.';
}

function methodParagraph(input: ExplanationInput): string {
  const knn = score(input.report, 'knn-rules');
  const gbdt = score(input.report, 'gbdt');
  const used =
    input.modelName === 'gbdt' ? 'gradient boosted trees' : 'the nearest-booking method';
  const lines = [
    `The price uses ${used}.`,
    'The nearest-booking method finds the nearest past bookings of the same booker type and takes their weighted median.',
    'A free-slot rule sets the price to £0 when the booker is a community, the booker brings leads, and at least half of those bookings were free.',
    'The gradient boosted model adds many small decision trees.',
    'The trees learn log(1 + price) from the venue history.',
    `On the held-out rows, the nearest-booking MAE is ${formatGbp(knn.maeGbp)} and the MAPE is ${percent(knn.mapePercent)}.`,
    `The gradient boosted MAE is ${formatGbp(gbdt.maeGbp)} and the MAPE is ${percent(gbdt.mapePercent)}.`,
    'MAPE uses only bookings with a price above £0.',
    `The winner on MAE is ${input.report.winner === 'gbdt' ? 'the gradient boosted model' : 'the nearest-booking method'}.`,
  ];
  if (input.modelName === 'gbdt') {
    const gap = Math.abs(input.gbdtPrice - input.knnPrice);
    if (gap <= 5) {
      lines.push('The nearest bookings agree with this price.');
    } else {
      lines.push(
        `The nearest bookings have a weighted median of ${formatGbp(input.knnPrice)}. The tree model price is ${formatGbp(input.gbdtPrice)}.`,
      );
    }
  } else if (input.freeRule) {
    lines.push('The free-slot rule set this community price to £0.');
  } else {
    lines.push('This price is the weighted median of the nearest past bookings, rounded to the nearest £5.');
  }
  lines.push(
    'The price uses a fit on every booking in this history. The MAE above does not use that full fit. The MAE uses the held-out split.',
  );
  return lines.join(' ');
}

function comparableSentence(comparables: readonly Comparable[]): string {
  if (comparables.length === 0) return 'The quote has no past booking to show.';
  const shown = comparables.slice(0, 3).map((row) => {
    const slot = `${row.isWeekend ? 'weekend' : 'weekday'} ${row.isEvening ? 'evening' : 'day'}`;
    const leads = row.broughtLeads ? 'brought leads' : 'did not bring leads';
    const free = row.freeCommunitySlot ? ', free slot' : '';
    return `${row.bookingId} on ${row.date} (${row.bookerType}, ${row.headcount} people, ${row.hours} hours, ${slot}, ${leads}, ${formatGbp(row.pricePaidGbp)}${free})`;
  });
  const extra =
    comparables.length > 3 ? ` The comparables list has ${comparables.length} bookings.` : '';
  return `The nearest past bookings are ${shown.join('; ')}.${extra}`;
}

function historyParagraph(history: readonly Booking[]): string {
  const summary = summarizeHistory(history);
  const community = summary.byType.community;
  const company = summary.byType.company;
  const startup = summary.byType.startup;
  const agency = summary.byType.agency;
  return [
    `This history has ${summary.count} bookings.`,
    `Community: ${community.count}. Startup: ${startup.count}. Agency: ${agency.count}. Company: ${company.count}.`,
    `Free community slots: ${summary.freeSlots}.`,
    `The median community price is ${gbp(community.medianGbp)}.`,
    `The median paid community price is ${gbp(community.paidMedianGbp)}.`,
    `The median startup price is ${gbp(startup.medianGbp)}.`,
    `The median company price is ${gbp(company.medianGbp)}.`,
    'Communities book often and bring leads, so the community price is lower.',
    'Companies book rarely and pay the full price.',
  ].join(' ');
}

function requestParagraph(request: QuoteRequest): string {
  const leads = request.broughtLeads
    ? 'The booker brings leads.'
    : 'The booker does not bring leads.';
  const prior =
    request.repeatBookerCount === 0
      ? 'This is the first booking for this booker.'
      : `This booker has ${request.repeatBookerCount} past bookings.`;
  const av = request.avNeeds ? 'AV is required.' : 'AV is not required.';
  const catering = request.cateringNeeds ? 'Catering is required.' : 'Catering is not required.';
  const calendarNote = calendarNoteFor(request);
  return [
    `The booker type is ${request.bookerType as BookerType}.`,
    `The date is ${request.date}.`,
    when(request),
    `The request is for ${request.hours} hours and ${request.headcount} people.`,
    prior,
    leads,
    av,
    catering,
    calendarNote,
  ]
    .filter((line) => line !== '')
    .join(' ');
}

function calendarNoteFor(request: QuoteRequest): string {
  const parsed = request.date;
  const weekendFromName = request.isWeekend;
  // The caller already validated the date. A mismatch is a flag, not a calendar error.
  const weekdayIndex = new Date(`${parsed}T00:00:00Z`).getUTCDay();
  const calendarWeekend = weekdayIndex === 0 || weekdayIndex === 6;
  if (calendarWeekend === weekendFromName) return '';
  return 'The weekend flag does not match the calendar date. The quote uses the weekend flag.';
}

/** Plain-language quote text. The text uses the history that was passed in. */
export function buildExplanation(input: ExplanationInput): string {
  const priceLine = `The quote is ${formatGbp(input.price)}. The range is ${formatGbp(input.range.low)} to ${formatGbp(input.range.high)}. Currency: GBP.`;
  return [
    historyParagraph(input.history),
    requestParagraph(input.request),
    priceLine,
    input.marketLine,
    discountParagraph(input.request, input.price, input.freeRule),
    comparableSentence(input.comparables),
    methodParagraph(input),
  ].join('\n\n');
}
