// Backup, restore and CSV export (spec 39): the native save and open dialogs,
// the files, and a restored backup becoming a new profile. The window never
// sends a path: main asks the user and keeps it. Logs hold counts only, never
// a path, a file name or row text.

import { randomBytes } from "node:crypto";
import { chmodSync, constants, copyFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { app, BrowserWindow, dialog, type FileFilter, type OpenDialogOptions, type SaveDialogOptions } from "electron";
import { BACKUP_MAX_BYTES, checkBackup, openDatabase, trimRestored, writeBackup, type Db } from "@core/db";
import { exportTransactionsCsv, israelToday } from "@core/ledger";
import { CodedError } from "@shared/errors";
import type { ProfileList, RestoreCounts, RestoreKeep, RestoredProfile } from "@shared/types";
import type { Handlers } from "./ipc";
import {
  addRestoredProfile,
  currentProfile,
  deleteProfile,
  readProfiles,
  removeDatabaseFiles,
  setCurrentProfile,
} from "./profiles";

export type SaveKind = "backup" | "csv";

/** The native dialogs. The app uses Electron's; tests pass fakes. */
export interface FileDialogs {
  /** Where to save, or null when the user cancels. */
  save(kind: SaveKind, defaultName: string): Promise<string | null>;
  /** The backup file to restore, or null when the user cancels. */
  openBackup(): Promise<string | null>;
}

const EXTENSION: Record<SaveKind, string> = { backup: "coinleak", csv: "csv" };
const FILTER_NAME: Record<SaveKind, string> = { backup: "CoinLeak backup", csv: "CSV for Excel" };
const filter = (kind: SaveKind): FileFilter => ({ name: FILTER_NAME[kind], extensions: [EXTENSION[kind]] });

export const electronDialogs: FileDialogs = {
  async save(kind, defaultName) {
    const options: SaveDialogOptions = {
      defaultPath: join(app.getPath("documents"), defaultName),
      filters: [filter(kind)],
      properties: ["showOverwriteConfirmation", "createDirectory"],
    };
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return null;
    // Linux does not add the extension the filter shows.
    return extname(filePath) === "" ? `${filePath}.${EXTENSION[kind]}` : filePath;
  },
  async openBackup() {
    const options: OpenDialogOptions = {
      defaultPath: app.getPath("documents"),
      filters: [
        filter("backup"),
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    };
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return canceled ? null : (filePaths[0] ?? null);
  },
};

export interface BackupDeps {
  dataDir: string;
  dialogs: FileDialogs;
  isSyncing(): boolean;
  /** The open profile's database. */
  getDb(): Db;
  /** Closes the open database and opens the current profile's from profiles.json. */
  openCurrentDb(): void;
  now(): Date;
}

type BackupChannel = "backup:create" | "backup:restore" | "backup:exportCsv";

export function backupHandlers(deps: BackupDeps): Pick<Handlers, BackupChannel> {
  const { dataDir, dialogs, getDb } = deps;
  const suggest = (what: string, extension: string) =>
    defaultName(what, currentProfile(readProfiles(dataDir)).name, israelToday(deps.now()), extension);
  return {
    "backup:create": async () => {
      const path = await dialogs.save("backup", suggest("CoinLeak backup", "coinleak"));
      if (!path) return null;
      refuseDataFolder(dataDir, path);
      const { transactions } = writeBackup(getDb(), path);
      console.log(`[backup] saved a backup of ${transactions} transactions`);
      return { fileName: basename(path), transactions };
    },
    "backup:exportCsv": async () => {
      const path = await dialogs.save("csv", suggest("CoinLeak transactions", "csv"));
      if (!path) return null;
      refuseDataFolder(dataDir, path);
      const { text, rows } = exportTransactionsCsv(getDb());
      writeWholeFile(path, text);
      console.log(`[backup] exported ${rows} transactions as CSV`);
      return { fileName: basename(path), transactions: rows };
    },
    "backup:restore": (keep) => restore(deps, keep),
  };
}

/**
 * Checks a copy of the chosen file in the data folder, then adds it as a new
 * profile, switches to it and takes out what was not chosen (spec 41 B). The
 * open profile's file is never written.
 */
async function restore(deps: BackupDeps, args: unknown): Promise<RestoredProfile | null> {
  const { dataDir, isSyncing, openCurrentDb } = deps;
  const keep = checkKeep(args);
  if (isSyncing()) throw new CodedError("SYNC_IN_PROGRESS");
  const source = await deps.dialogs.openBackup();
  if (!source) return null;
  // A sync may have started while the dialog was open.
  if (isSyncing()) throw new CodedError("SYNC_IN_PROGRESS");

  const copy = copyIntoDataFolder(dataDir, source);
  const list = readProfiles(dataDir);
  let profile;
  let brought: RestoreCounts;
  try {
    checkBackup(copy);
    // A read-only check of a WAL file can leave empty -wal and -shm files beside it.
    for (const side of [`${copy}-wal`, `${copy}-shm`]) rmSync(side, { force: true });
    // Trimmed before it becomes a profile: what was left out is never in one, even if the app stops here.
    brought = trimCopy(copy, keep);
    profile = addRestoredProfile(dataDir, restoredName(list, israelToday(deps.now())), copy);
  } catch (e) {
    removeDatabaseFiles(copy);
    throw e instanceof CodedError ? e : new CodedError("DATABASE");
  }

  setCurrentProfile(dataDir, profile.id);
  try {
    openCurrentDb();
  } catch {
    // It would not open: back to where we were, and the restored profile goes again.
    setCurrentProfile(dataDir, list.current);
    try {
      // Closes the restored database before its files are deleted.
      openCurrentDb();
    } finally {
      deleteProfile(dataDir, profile.id);
    }
    throw new CodedError("DATABASE");
  }
  console.log("[backup] restored a backup as a new profile");
  return { ...profile, brought };
}

/** Three yes or no answers, at least one yes. */
function checkKeep(args: unknown): RestoreKeep {
  const { transactions, rules, budgets } = (args ?? {}) as Partial<Record<keyof RestoreKeep, unknown>>;
  if (typeof transactions !== "boolean" || typeof rules !== "boolean" || typeof budgets !== "boolean") {
    throw new CodedError("BAD_REQUEST");
  }
  if (!transactions && !rules && !budgets) throw new CodedError("BAD_REQUEST");
  return { transactions, rules, budgets };
}

/** A private copy of the chosen file in the data folder. The user's own file is only read. */
function copyIntoDataFolder(dataDir: string, source: string): string {
  let size: number;
  try {
    size = statSync(source).size;
  } catch {
    throw new CodedError("FILE_NOT_READ");
  }
  // Refused before copying anything; checkBackup checks the copy again.
  if (size > BACKUP_MAX_BYTES) throw new CodedError("BACKUP_NOT_COINLEAK");
  // A `.db` name, so "Delete everything" finds it too if anything ever leaves it behind.
  const copy = join(dataDir, `restore-${randomBytes(6).toString("hex")}.db`);
  try {
    copyFileSync(source, copy, constants.COPYFILE_EXCL);
    if (process.platform !== "win32") chmodSync(copy, 0o600);
  } catch {
    removeDatabaseFiles(copy);
    throw new CodedError("FILE_NOT_READ");
  }
  return copy;
}

/** "Restored 2026-11-25", or "Restored 2026-11-25 (2)" when that name is taken. */
function restoredName(list: ProfileList, today: string): string {
  const taken = new Set(list.profiles.map((p) => p.name));
  const base = `Restored ${today}`;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
  return name;
}

/** "CoinLeak backup Me 2026-11-25.coinleak", without characters a file name cannot hold. */
export function defaultName(what: string, profile: string, day: string, extension: string): string {
  const safe = profile
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${what} ${safe === "" ? "" : `${safe} `}${day}.${extension}`;
}

/** Nothing is saved into the data folder, where a file could replace a profile's database. */
function refuseDataFolder(dataDir: string, path: string): void {
  if (realFolder(dirname(path)) === realFolder(dataDir)) throw new CodedError("FILE_NOT_SAVED");
}

function realFolder(dir: string): string {
  try {
    return realpathSync.native(dir);
  } catch {
    return resolve(dir);
  }
}

/** Writes a temp file next to `path`, then renames it into place, so a failed save never leaves half a file. */
function writeWholeFile(path: string, text: string): void {
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(temp, text, { mode: 0o600 });
    renameSync(temp, path);
  } catch {
    rmSync(temp, { force: true });
    throw new CodedError("FILE_NOT_SAVED");
  }
}

/** Opens the checked copy (running any migrations newer than the backup), takes out what was not kept, closes it. */
function trimCopy(path: string, keep: RestoreKeep): RestoreCounts {
  const db = openDatabase(path);
  try {
    return trimRestored(db, keep);
  } finally {
    db.close();
  }
}
