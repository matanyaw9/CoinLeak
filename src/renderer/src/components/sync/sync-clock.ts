// The sync's elapsed time (spec 18): starts with the first stage, stops on
// done, failed or cancel. Real time only, never a made-up percentage.

import type { SyncStage } from "@shared/types";

export interface SyncClock {
  startedAt: number | null;
  stoppedAt: number | null;
}

export type ClockEvent =
  | { type: "start"; at: number }
  | { type: "stage"; stage: SyncStage; at: number }
  | { type: "cancel"; at: number }
  | { type: "end" };

export const IDLE: SyncClock = { startedAt: null, stoppedAt: null };

export function onClock(clock: SyncClock, event: ClockEvent): SyncClock {
  switch (event.type) {
    case "start":
      return { startedAt: event.at, stoppedAt: null };
    case "stage":
      return event.stage === "done" || event.stage === "failed" ? stop(clock, event.at) : clock;
    case "cancel":
      return stop(clock, event.at);
    case "end":
      return IDLE;
  }
}

function stop(clock: SyncClock, at: number): SyncClock {
  if (clock.startedAt === null || clock.stoppedAt !== null) return clock;
  return { ...clock, stoppedAt: at };
}

export const ticking = (clock: SyncClock): boolean => clock.startedAt !== null && clock.stoppedAt === null;

/** Milliseconds since the start, frozen once stopped; null when no sync runs. */
export function elapsedMs(clock: SyncClock, now: number): number | null {
  if (clock.startedAt === null) return null;
  return Math.max(0, (clock.stoppedAt ?? now) - clock.startedAt);
}

/** "0:07", "1:23", "12:05". */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
