// The profile list file, `profiles.json` in the data folder: which profiles
// exist, the database file each one uses, and which one is open. Every
// change reads the file, changes it, and writes it back whole (atomically).

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CodedError } from "@shared/errors";
import type { Profile, ProfileList } from "@shared/types";

const LIST_FILE = "profiles.json";
const NAME_MAX = 40;
// Database files stay inside the data folder: a name, never a path.
const SAFE_FILE = /^[a-z0-9-]+\.db$/;

/** Today's data, from before profiles existed, becomes the "Me" profile. */
const FIRST_LIST: ProfileList = {
  current: "me",
  profiles: [{ id: "me", name: "Me", file: "coinleak.db", demo: false }],
};

export const DEMO_PROFILE: Profile = { id: "demo", name: "Demo", file: "demo.db", demo: true };

/** The list, created with the "Me" profile when there is none. A broken file is DATABASE, never replaced. */
export function readProfiles(dataDir: string): ProfileList {
  const path = join(dataDir, LIST_FILE);
  if (!existsSync(path)) {
    writeProfiles(dataDir, FIRST_LIST);
    return structuredClone(FIRST_LIST);
  }
  let list: unknown;
  try {
    list = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new CodedError("DATABASE");
  }
  if (!isProfileList(list)) throw new CodedError("DATABASE");
  return list;
}

/** Writes a temp file, then renames it over the list, so a crash never leaves half a file. */
export function writeProfiles(dataDir: string, list: ProfileList): void {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, LIST_FILE);
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(list, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}

export function currentProfile(list: ProfileList): Profile {
  return findProfile(list, list.current);
}

export function databasePath(dataDir: string, profile: Profile): string {
  return join(dataDir, profile.file);
}

export function addProfile(dataDir: string, name: string): Profile {
  const list = readProfiles(dataDir);
  let n = list.profiles.length + 1;
  while (list.profiles.some((p) => p.id === `p${n}`)) n++;
  const profile: Profile = { id: `p${n}`, name: cleanName(name), file: `profile-p${n}.db`, demo: false };
  writeProfiles(dataDir, { ...list, profiles: [...list.profiles, profile] });
  return profile;
}

/** Only one Demo profile at a time. */
export function addDemoProfile(dataDir: string): Profile {
  const list = readProfiles(dataDir);
  if (list.profiles.some((p) => p.demo)) throw new CodedError("BAD_REQUEST");
  writeProfiles(dataDir, { ...list, profiles: [...list.profiles, DEMO_PROFILE] });
  return DEMO_PROFILE;
}

export function renameProfile(dataDir: string, id: string, name: string): void {
  const list = readProfiles(dataDir);
  const profile = findProfile(list, id);
  profile.name = cleanName(name);
  writeProfiles(dataDir, list);
}

/** Removes the profile and its database file. Never the open one, never the last real one. */
export function deleteProfile(dataDir: string, id: string): void {
  const list = readProfiles(dataDir);
  const profile = findProfile(list, id);
  const realOnes = list.profiles.filter((p) => !p.demo);
  if (id === list.current || (!profile.demo && realOnes.length === 1)) throw new CodedError("BAD_REQUEST");
  writeProfiles(dataDir, { ...list, profiles: list.profiles.filter((p) => p.id !== id) });
  removeDatabaseFiles(databasePath(dataDir, profile));
}

export function setCurrentProfile(dataDir: string, id: string): void {
  const list = readProfiles(dataDir);
  findProfile(list, id);
  writeProfiles(dataDir, { ...list, current: id });
}

/** A SQLite database is up to three files: the file and its WAL and shared-memory files. */
export function removeDatabaseFiles(path: string): void {
  for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
}

function findProfile(list: ProfileList, id: unknown): Profile {
  const profile = list.profiles.find((p) => p.id === id);
  if (!profile) throw new CodedError("BAD_REQUEST");
  return profile;
}

function cleanName(name: unknown): string {
  if (typeof name !== "string") throw new CodedError("BAD_REQUEST");
  const clean = name.trim();
  if (clean.length === 0 || clean.length > NAME_MAX) throw new CodedError("BAD_REQUEST");
  return clean;
}

function isProfileList(value: unknown): value is ProfileList {
  if (typeof value !== "object" || value === null) return false;
  const list = value as Partial<ProfileList>;
  if (!Array.isArray(list.profiles) || list.profiles.length === 0) return false;
  const ok = list.profiles.every(
    (p: Partial<Profile>) =>
      typeof p === "object" &&
      p !== null &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.file === "string" &&
      SAFE_FILE.test(p.file) &&
      typeof p.demo === "boolean",
  );
  return ok && list.profiles.some((p) => p.id === list.current);
}
