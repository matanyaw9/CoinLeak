// How far back each provider's download reaches with israeli-bank-scrapers
// 6.12.2, the start date we hand the library, and the first day a download
// surely covers. Every clamp is the library's own, cited by file and line.

import type { EnabledProviderId } from "@shared/providers";
import type { IsoDate } from "@shared/types";
import { israelDay } from "./normalize";

interface History {
  /** The library's earliest day, counted back from `today` the way moment does. */
  earliest: (today: IsoDate) => IsoDate;
  /**
   * False when the library takes any start date as given (no clamp): we
   * then ask for `earliest` ourselves, one year like its own default.
   */
  clamps: boolean;
}

const back = (months: number, plusDays = 0) => (today: IsoDate) => addDays(addMonths(today, -months), plusDays);

const DISCOUNT: History = { earliest: back(12, 2), clamps: true }; // discount.js L51-53
const ISRACARD_AMEX: History = { earliest: back(12), clamps: true }; // base-isracard-amex.js L411-413
const BEINLEUMI_GROUP: History = { earliest: back(12, 1), clamps: false }; // base-beinleumi-group.js L418-423

export const HISTORY: Readonly<Record<EnabledProviderId, History>> = {
  discount: DISCOUNT,
  mercantile: DISCOUNT, // mercantile.js L9: Discount's scraper
  visaCal: { earliest: (t) => addDays(addMonths(addMonths(t, -12), -6), 1), clamps: true }, // visa-cal.js L388-390
  hapoalim: { earliest: back(12, 1), clamps: true }, // hapoalim.js L137-139
  leumi: { earliest: back(36, 1), clamps: true }, // leumi/leumi.js L241-244
  mizrahi: { earliest: back(12), clamps: true }, // mizrahi.js L67-71
  yahav: { earliest: back(3, 1), clamps: true }, // yahav.js L239-241
  max: { earliest: back(48), clamps: true }, // max.js L247-250
  isracard: ISRACARD_AMEX,
  amex: ISRACARD_AMEX,
  beyahadBishvilha: { earliest: back(12), clamps: true }, // beyahad-bishvilha.js L70-72
  beinleumi: BEINLEUMI_GROUP,
  massad: BEINLEUMI_GROUP,
  otsarHahayal: BEINLEUMI_GROUP,
  pagi: BEINLEUMI_GROUP,
  behatsdaa: { earliest: back(12, 1), clamps: false }, // behatsdaa.js L82: startDate used as given
};

/** Asked of a library that clamps: as far back as it allows. */
const EARLIEST = new Date("2000-01-01T00:00:00Z");

/**
 * The start date for the library. A library that clamps gets the request
 * as is (or 2000, meaning "all it allows"). One that does not clamp gets the
 * later of the request and our own floor, at 00:00 UTC of that Israel day:
 * in any time zone the library then starts on that day or the one before.
 */
export function requestStart(provider: EnabledProviderId, requested: Date | undefined, now: () => Date): Date {
  const history = HISTORY[provider];
  if (history.clamps) return requested ?? EARLIEST;
  const floor = new Date(`${history.earliest(israelDay(now().toISOString()))}T00:00:00Z`);
  return requested && requested > floor ? requested : floor;
}

/**
 * The first Israel day a download surely covers: the later of the day asked
 * for and the library's clamp, plus one day for safety. The library counts
 * from this computer's clock and zone, whose day can be one ahead of
 * Israel's, so the clamp from the next Israel day counts too. `now` must be
 * no earlier than the moment the library started.
 */
export function effectiveStartDate(provider: EnabledProviderId, requested: Date, now: Date): IsoDate {
  const clamp = HISTORY[provider].earliest;
  const today = israelDay(now.toISOString());
  const candidates = [
    addDays(clamp(today), 1),
    clamp(addDays(today, 1)),
    addDays(israelDay(requested.toISOString()), 1),
  ];
  return candidates.reduce((a, b) => (a > b ? a : b));
}

/** Moves a day by whole months like moment: the day clamps to the end of a shorter month. */
export function addMonths(day: IsoDate, months: number): IsoDate {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return isoDay(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
}

export function addDays(day: IsoDate, days: number): IsoDate {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return isoDay(Date.UTC(y, m - 1, d + days));
}

function isoDay(utcMs: number): IsoDate {
  return new Date(utcMs).toISOString().slice(0, 10);
}
