// The channel list: the compile-time check holds, and no channel is listed twice.

import { describe, expect, it } from "vitest";
import { CHANNELS, EVENTS, EVERY_CHANNEL_LISTED } from "./ipc";

describe("CHANNELS", () => {
  it("lists every channel of the contract (checked by the compiler)", () => {
    expect(EVERY_CHANNEL_LISTED).toBe(true);
  });

  it("lists each channel once, each named domain:action", () => {
    expect(new Set(CHANNELS).size).toBe(CHANNELS.length);
    for (const channel of [...CHANNELS, ...EVENTS]) expect(channel).toMatch(/^[a-z]+:[a-zA-Z]+$/);
  });
});
