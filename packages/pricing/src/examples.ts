import type { QuoteRequest } from './types.js';

export interface ExampleRequest {
  title: string;
  request: QuoteRequest;
}

/**
 * Three requests that are not in the SAMPLE window.
 * The SAMPLE history ends on 2026-09-30.
 */
export const EXAMPLE_REQUESTS: readonly ExampleRequest[] = [
  {
    title: 'Community 80-person evening hack',
    request: {
      date: '2026-11-12',
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 80,
      bookerType: 'community',
      repeatBookerCount: 6,
      broughtLeads: true,
      avNeeds: true,
      cateringNeeds: false,
    },
  },
  {
    title: 'Startup launch',
    request: {
      date: '2026-11-19',
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 100,
      bookerType: 'startup',
      repeatBookerCount: 0,
      broughtLeads: true,
      avNeeds: true,
      cateringNeeds: true,
    },
  },
  {
    title: 'Corporate offsite',
    request: {
      date: '2026-11-18',
      isEvening: false,
      isWeekend: false,
      hours: 8,
      headcount: 45,
      bookerType: 'company',
      repeatBookerCount: 0,
      broughtLeads: false,
      avNeeds: true,
      cateringNeeds: true,
    },
  },
];
