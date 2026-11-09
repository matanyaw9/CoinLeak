// The profile list file: today's data becomes "Me", changes survive a fresh
// read, deletes are refused where they would lose the open or last profile.

import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addDemoProfile,
  addProfile,
  currentProfile,
  deleteProfile,
  readProfiles,
  renameProfile,
  setCurrentProfile,
} from "./profiles";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(process.env["TMPDIR"] ?? tmpdir(), "coinleak-profiles-"));
});

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe("profiles.json", () => {
  it("without a list, makes one 'Me' profile on coinleak.db and moves nothing", () => {
    writeFileSync(join(dir, "coinleak.db"), "existing data");
    const list = readProfiles(dir);
    expect(list).toEqual({ current: "me", profiles: [{ id: "me", name: "Me", file: "coinleak.db", demo: false }] });
    expect(readFileSync(join(dir, "coinleak.db"), "utf8")).toBe("existing data");
    expect(readdirSync(dir).sort()).toEqual(["coinleak.db", "profiles.json"]);
  });

  it("add, rename, switch and delete persist across a fresh read", () => {
    const work = addProfile(dir, "  Work  ");
    expect(work).toEqual({ id: "p2", name: "Work", file: "profile-p2.db", demo: false });
    renameProfile(dir, work.id, "Business");
    setCurrentProfile(dir, work.id);
    expect(currentProfile(readProfiles(dir))).toMatchObject({ id: "p2", name: "Business" });

    setCurrentProfile(dir, "me");
    writeFileSync(join(dir, "profile-p2.db"), "x");
    deleteProfile(dir, work.id);
    expect(readProfiles(dir).profiles.map((p) => p.id)).toEqual(["me"]);
    expect(existsSync(join(dir, "profile-p2.db"))).toBe(false);
    expect(readdirSync(dir).some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("refuses to delete the open profile and the last real profile", () => {
    expect(code(() => deleteProfile(dir, "me"))).toBe("BAD_REQUEST");
    const demo = addDemoProfile(dir);
    setCurrentProfile(dir, demo.id);
    expect(code(() => deleteProfile(dir, "me"))).toBe("BAD_REQUEST");
    expect(code(() => deleteProfile(dir, demo.id))).toBe("BAD_REQUEST");
    setCurrentProfile(dir, "me");
    deleteProfile(dir, demo.id);
    expect(readProfiles(dir).profiles).toHaveLength(1);
  });

  it("allows one Demo profile, on demo.db", () => {
    expect(addDemoProfile(dir)).toEqual({ id: "demo", name: "Demo", file: "demo.db", demo: true });
    expect(code(() => addDemoProfile(dir))).toBe("BAD_REQUEST");
  });

  it("refuses empty or long names and unknown ids", () => {
    expect(code(() => addProfile(dir, "   "))).toBe("BAD_REQUEST");
    expect(code(() => addProfile(dir, "x".repeat(41)))).toBe("BAD_REQUEST");
    expect(code(() => setCurrentProfile(dir, "nobody"))).toBe("BAD_REQUEST");
  });

  it("a broken list is a coded error and is left as it is", () => {
    writeFileSync(join(dir, "profiles.json"), "{ not json");
    expect(code(() => readProfiles(dir))).toBe("DATABASE");
    const escape = { current: "me", profiles: [{ id: "me", name: "Me", file: "../elsewhere.db", demo: false }] };
    writeFileSync(join(dir, "profiles.json"), JSON.stringify(escape));
    expect(code(() => readProfiles(dir))).toBe("DATABASE");
    expect(readFileSync(join(dir, "profiles.json"), "utf8")).toBe(JSON.stringify(escape));
  });
});
