import { describe, expect, it, vi } from "vitest";
import { CodedError } from "@shared/errors";
import { openAtStartup } from "./startup";

describe("openAtStartup", () => {
  it("opens the database and logs nothing when it works", () => {
    const open = vi.fn();
    const log = vi.fn();
    openAtStartup(open, log);
    expect(open).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it("carries on without a database when the file will not open, so the window still opens", () => {
    const log = vi.fn();
    expect(() =>
      openAtStartup(() => {
        throw new CodedError("DATABASE");
      }, log),
    ).not.toThrow();
    expect(log).toHaveBeenCalledWith("[db] could not open the data file: DATABASE");
  });

  it("logs only a code, never the error's own text", () => {
    const log = vi.fn();
    openAtStartup(() => {
      throw new Error("database disk image is malformed: /home/someone/secret/coinleak.db");
    }, log);
    expect(log).toHaveBeenCalledWith("[db] could not open the data file: UNKNOWN");
    expect(String(log.mock.calls[0]?.[0])).not.toContain("secret");
  });
});
