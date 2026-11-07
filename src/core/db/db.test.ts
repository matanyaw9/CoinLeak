import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, openDatabase, transaction } from "./index";
import { MIGRATIONS } from "./migrations";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("openDatabase", () => {
  it("applies every migration once and records it", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as { version: number }[];
    expect(rows.map((r) => r.version)).toEqual(MIGRATIONS.map((m) => m.version));
  });

  it("creates the file and its folder private to the user", () => {
    if (process.platform === "win32") return;
    const dir = mkdtempSync(join(tmpdir(), "coinleak-"));
    dirs.push(dir);
    const path = join(dir, "nested", "coinleak.db");
    openDatabase(path).close();
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "nested")).mode & 0o777).toBe(0o700);
  });
});

describe("transaction", () => {
  it("rolls back everything when the body throws", () => {
    const db = openDatabase(":memory:");
    expect(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO settings (key, value) VALUES ('a', '1')").run();
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(db.prepare("SELECT COUNT(*) AS n FROM settings").get()).toEqual({ n: 0 });
  });
});
