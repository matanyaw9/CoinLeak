// Backup, restore and CSV export in main (spec 39), with real files in a temp
// data folder and fake dialogs: restore adds a profile and never touches the
// open one, refusals leave nothing behind, and no log line holds a path.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkBackup, openDatabase, trimRestored, writeBackup, type Db } from "@core/db";
import { ingest } from "@core/ledger";
import { bank, NOW, txn } from "@core/testing/ledger";
import { backupHandlers, defaultName, electronDialogs, type BackupDeps, type FileDialogs } from "./backup";
import { currentProfile, databasePath, readProfiles } from "./profiles";

const electron = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { getPath: () => "/home/someone/Documents" },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showSaveDialog: electron.showSaveDialog, showOpenDialog: electron.showOpenDialog },
}));
// The real trimming, which one test makes fail.
vi.mock("@core/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@core/db")>();
  return { ...real, trimRestored: vi.fn(real.trimRestored) };
});

/** Everything ticked, as the dialog opens. */
const ALL = { transactions: true, rules: true, budgets: true };

let root: string;
let dataDir: string;
let outside: string;
let db: Db | undefined;
let syncing = false;
/** What the fake dialogs answer: a path, or null for Cancel. */
let chosen: string | null = null;
const dialogs = {
  save: vi.fn(() => Promise.resolve(chosen)),
  openBackup: vi.fn(() => Promise.resolve(chosen)),
} satisfies FileDialogs;

function getDb(): Db {
  if (!db) throw new Error("no database open");
  return db;
}

function closeDb(): void {
  db?.close();
  db = undefined;
}

function openCurrentDb(): void {
  closeDb();
  db = openDatabase(databasePath(dataDir, currentProfile(readProfiles(dataDir))));
}

/** The "Me" profile open with two rows, and the three channels as the window calls them. */
function setup(overrides: Partial<BackupDeps> = {}) {
  openCurrentDb();
  ingest(
    getDb(),
    [
      bank([
        txn({ date: "2026-03-02", amount: -5000, description: "חנות" }),
        txn({ date: "2026-03-03", amount: -4590, description: "Cafe" }),
      ]),
    ],
    { now: NOW },
  );
  return backupHandlers({
    dataDir,
    dialogs,
    isSyncing: () => syncing,
    getDb,
    openCurrentDb,
    now: () => NOW,
    ...overrides,
  });
}

/** A backup made on "another computer": its own database with one row. */
function otherComputerBackup(name = "from-laptop.coinleak"): string {
  const other = openDatabase(join(root, "laptop", "coinleak.db"));
  ingest(other, [bank([txn({ date: "2026-02-01", amount: -12000, description: "Laptop row" })])], { now: NOW });
  const path = join(outside, name);
  writeBackup(other, path);
  other.close();
  return path;
}

const descriptions = (d: Db) =>
  (d.prepare("SELECT description FROM transactions ORDER BY date").all() as { description: string }[]).map(
    (r) => r.description,
  );

const code = async (p: unknown): Promise<string | undefined> => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

beforeEach(() => {
  root = mkdtempSync(join(process.env["TMPDIR"] ?? tmpdir(), "coinleak-main-backup-"));
  dataDir = join(root, "data");
  outside = join(root, "Documents");
  mkdirSync(outside);
  syncing = false;
  chosen = null;
  vi.clearAllMocks();
});
afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("Back up now", () => {
  it("writes the open profile to the chosen file and answers with its name only", async () => {
    const ask = setup();
    chosen = join(outside, "b.coinleak");
    expect(await ask["backup:create"](undefined)).toEqual({ fileName: "b.coinleak", transactions: 2 });
    expect(dialogs.save).toHaveBeenCalledWith("backup", "CoinLeak backup Me 2026-03-31.coinleak");
    expect(() => checkBackup(join(outside, "b.coinleak"))).not.toThrow();
  });

  it("a cancelled dialog does nothing", async () => {
    const ask = setup();
    const before = readdirSync(dataDir);
    expect(await ask["backup:create"](undefined)).toBeNull();
    expect(await ask["backup:exportCsv"](undefined)).toBeNull();
    expect(await ask["backup:restore"](ALL)).toBeNull();
    expect(readdirSync(outside)).toEqual([]);
    expect(readdirSync(dataDir)).toEqual(before);
    expect(readProfiles(dataDir).profiles).toHaveLength(1);
  });

  it("never saves into the data folder, where it could replace a profile's database", async () => {
    const ask = setup();
    chosen = join(dataDir, "coinleak.db");
    expect(await code(ask["backup:create"](undefined))).toBe("FILE_NOT_SAVED");
    expect(await code(ask["backup:exportCsv"](undefined))).toBe("FILE_NOT_SAVED");
    expect(descriptions(getDb())).toEqual(["חנות", "Cafe"]);
  });
});

describe("Restore from backup", () => {
  it("adds a new profile, switches to it, and never touches the open one's file", async () => {
    const ask = setup();
    const source = otherComputerBackup();
    const sourceBytes = readFileSync(source);
    chosen = source;

    const profile = await ask["backup:restore"](ALL);
    expect(profile).toMatchObject({ name: "Restored 2026-03-31", demo: false });
    const list = readProfiles(dataDir);
    expect(list.profiles.map((p) => p.name)).toEqual(["Me", "Restored 2026-03-31"]);
    expect(list.current).toBe(profile?.id);
    expect(descriptions(getDb())).toEqual(["Laptop row"]);

    // The old profile keeps its rows and its file; the user's backup file is unchanged.
    const me = new DatabaseSync(join(dataDir, "coinleak.db"), { readOnly: true });
    expect(descriptions(me)).toEqual(["חנות", "Cafe"]);
    me.close();
    expect(readFileSync(source).equals(sourceBytes)).toBe(true);
    // Only the profile's own files are left: no copy, no -wal or -shm of the check.
    expect(readdirSync(dataDir).filter((n) => n.startsWith("restore-"))).toEqual([]);

    // A second restore the same day gets its own name.
    expect(await ask["backup:restore"](ALL)).toMatchObject({ name: "Restored 2026-03-31 (2)" });
  });

  it("leaves nothing behind in the data folder for a refused file, and stays on the open profile", async () => {
    const ask = setup();
    const good = otherComputerBackup();
    const bytes = readFileSync(good);
    const damaged = Buffer.from(bytes);
    damaged.fill(0xa5, 4096 * 3, 4096 * 6);
    const withTrigger = join(outside, "trigger.coinleak");
    writeFileSync(withTrigger, bytes);
    const raw = new DatabaseSync(withTrigger);
    raw.exec("CREATE TRIGGER sneaky AFTER INSERT ON transactions BEGIN SELECT 1; END");
    raw.close();
    const newer = join(outside, "newer.coinleak");
    writeFileSync(newer, bytes);
    const rawNewer = new DatabaseSync(newer);
    rawNewer.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (9999, '2030-01-01')");
    rawNewer.close();
    writeFileSync(join(outside, "notes.coinleak"), "not a database");
    writeFileSync(join(outside, "damaged.coinleak"), damaged);

    const files = {
      "notes.coinleak": "BACKUP_NOT_COINLEAK",
      "damaged.coinleak": "BACKUP_DAMAGED",
      "trigger.coinleak": "BACKUP_NOT_COINLEAK",
      "newer.coinleak": "BACKUP_TOO_NEW",
      "missing.coinleak": "FILE_NOT_READ",
    };
    const before = readdirSync(dataDir).sort();
    for (const [name, expected] of Object.entries(files)) {
      chosen = join(outside, name);
      expect(await code(ask["backup:restore"](ALL))).toBe(expected);
      expect(readdirSync(dataDir).sort()).toEqual(before);
    }
    expect(readProfiles(dataDir).profiles.map((p) => p.name)).toEqual(["Me"]);
    expect(descriptions(getDb())).toEqual(["חנות", "Cafe"]);
  });

  it("is refused while a sync runs, before any dialog opens", async () => {
    const ask = setup();
    chosen = otherComputerBackup();
    syncing = true;
    expect(await code(ask["backup:restore"](ALL))).toBe("SYNC_IN_PROGRESS");
    expect(dialogs.openBackup).not.toHaveBeenCalled();
    expect(readProfiles(dataDir).profiles).toHaveLength(1);
  });

  it("brings over only what was chosen, and says how much", async () => {
    const ask = setup();
    chosen = otherComputerBackup();
    expect((await ask["backup:restore"](ALL))?.brought).toEqual({ transactions: 1, rules: 0, budgets: true });
    expect(descriptions(getDb())).toEqual(["Laptop row"]);

    const rulesOnly = await ask["backup:restore"]({ transactions: false, rules: true, budgets: false });
    expect(rulesOnly?.brought).toEqual({ transactions: null, rules: 0, budgets: false });
    expect(readProfiles(dataDir).current).toBe(rulesOnly?.id);
    expect(descriptions(getDb())).toEqual([]);
  });

  it("refuses a choice that is not three yes or no answers with one yes, before any dialog", async () => {
    const ask = setup();
    chosen = otherComputerBackup();
    const bad = [
      undefined,
      null,
      "all",
      {},
      { transactions: true, rules: true },
      { transactions: 1, rules: true, budgets: true },
      { transactions: false, rules: false, budgets: false },
    ];
    for (const args of bad) expect(await code(ask["backup:restore"](args as never))).toBe("BAD_REQUEST");
    expect(dialogs.openBackup).not.toHaveBeenCalled();
    expect(readProfiles(dataDir).profiles).toHaveLength(1);
  });

  it("leaves no new profile when the trimming fails, and the open one stays open", async () => {
    const ask = setup();
    vi.mocked(trimRestored).mockImplementationOnce(() => {
      throw new Error("broken");
    });
    chosen = otherComputerBackup();
    const before = readdirSync(dataDir).filter((n) => !/-(wal|shm)$/.test(n)).sort();
    expect(await code(ask["backup:restore"](ALL))).toBe("DATABASE");
    expect(readProfiles(dataDir).current).toBe("me");
    expect(readProfiles(dataDir).profiles.map((p) => p.name)).toEqual(["Me"]);
    expect(readdirSync(dataDir).filter((n) => !/-(wal|shm)$/.test(n)).sort()).toEqual(before);
    expect(descriptions(getDb())).toEqual(["חנות", "Cafe"]);
  });
});

describe("Export transactions (CSV)", () => {
  it("writes the CSV with a BOM where the user chose", async () => {
    const ask = setup();
    chosen = join(outside, "t.csv");
    expect(await ask["backup:exportCsv"](undefined)).toEqual({ fileName: "t.csv", transactions: 2 });
    expect(dialogs.save).toHaveBeenCalledWith("csv", "CoinLeak transactions Me 2026-03-31.csv");
    const bytes = readFileSync(join(outside, "t.csv"));
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString("utf8")).toContain("חנות");
  });
});

describe("logs", () => {
  it("never hold a path or a file name", async () => {
    const lines: string[] = [];
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
    }
    const ask = setup();
    chosen = join(outside, "secret-name.coinleak");
    await ask["backup:create"](undefined);
    chosen = join(outside, "secret-name.csv");
    await ask["backup:exportCsv"](undefined);
    chosen = otherComputerBackup("secret-restore.coinleak");
    await ask["backup:restore"](ALL);
    writeFileSync(join(outside, "secret-bad.coinleak"), "nope");
    chosen = join(outside, "secret-bad.coinleak");
    await code(ask["backup:restore"](ALL));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain(root);
      expect(line).not.toContain("secret");
      expect(line).not.toContain("Laptop row");
    }
  });
});

describe("dialogs", () => {
  it("start in Documents, and add the extension Linux leaves off", async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/home/someone/Documents/my backup" });
    expect(await electronDialogs.save("backup", "CoinLeak backup Me 2026-11-25.coinleak")).toBe(
      "/home/someone/Documents/my backup.coinleak",
    );
    expect(electron.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: join("/home/someone/Documents", "CoinLeak backup Me 2026-11-25.coinleak") }),
    );
    electron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/home/someone/t.csv" });
    expect(await electronDialogs.save("csv", "x.csv")).toBe("/home/someone/t.csv");
    electron.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
    expect(await electronDialogs.save("csv", "x.csv")).toBeNull();
    electron.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await electronDialogs.openBackup()).toBeNull();
  });

  it("suggest a file name without characters a file system refuses", () => {
    expect(defaultName("CoinLeak backup", 'Home/Work: "A"*', "2026-11-25", "coinleak")).toBe(
      "CoinLeak backup Home Work A 2026-11-25.coinleak",
    );
    expect(defaultName("CoinLeak transactions", "  ", "2026-11-25", "csv")).toBe("CoinLeak transactions 2026-11-25.csv");
  });
});
