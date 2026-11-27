// App entry: hardening, data folder, database, IPC, and the one window.

import { app, BrowserWindow, dialog, nativeTheme, session } from "electron";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Db } from "@core/db";
import { createDemoDatabase } from "@core/demo";
import { ingest } from "@core/ledger";
import { CodedError, ERROR_MESSAGES, toAppError } from "@shared/errors";
import { createHandlers } from "./handlers";
import { currentProfile, databasePath, DEMO_PROFILE, readProfiles, writeProfiles } from "./profiles";
import { emit, registerIpc } from "./ipc";
import { runSync } from "./sync";
import { removeLeftoverProfiles } from "./sync/browser";
import { createSyncService, quitAfterSync } from "./sync-service";
import { isAppUrl, APP_ORIGIN } from "./policy";
import { registerAppScheme, serveAppFiles } from "./protocol";
import { hardenAllWebContents, hardenSession } from "./security";
import { openAtStartup } from "./startup";

const dev = !app.isPackaged;
const devServerUrl = dev ? process.env["ELECTRON_RENDERER_URL"] : undefined;
const here = import.meta.dirname;

// Dev runs keep their own data so experiments never touch real data.
if (dev) app.setPath("userData", join(app.getPath("appData"), "CoinLeak-dev"));
const screenshotRun = dev && Boolean(process.env["COINLEAK_SCREENSHOT"]);
// Screenshot runs use a fresh temp folder with only a seeded Demo profile, and
// never open (and migrate) the dev database: a branch build once stamped a
// migration number main did not have.
const dataDir =
  screenshotRun
    ? mkdtempSync(join(tmpdir(), "coinleak-shot-"))
    : (process.env["COINLEAK_DATA_DIR"] ?? join(app.getPath("userData"), "data"));

app.enableSandbox();
registerAppScheme();
hardenAllWebContents(devServerUrl);

let db: Db | undefined;
let mainWindow: BrowserWindow | undefined;

// Dev screenshot runs skip the single-instance lock: it needs a local socket,
// which sandboxed tooling cannot open. Packaged builds always take the lock.
if (!screenshotRun && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // The window can be gone while a quit still waits for the sync to stop.
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start).catch(failedToStart);
}

/** Never a hidden app with no window: say so and quit. The code only, never the error's text. */
function failedToStart(e: unknown): void {
  console.error(`[app] start failed: ${toAppError(e).code}`);
  dialog.showErrorBox("CoinLeak could not start", ERROR_MESSAGES.UNKNOWN);
  app.quit();
}

// One database is open at a time: the current profile's (spec 19).
function getDb(): Db {
  if (!db) throw new CodedError("DATABASE");
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

function start(): void {
  hardenSession(session.defaultSession, devServerUrl);
  serveAppFiles(join(here, "../renderer"));
  // Screenshot runs show the real app on made-up data: only a Demo profile.
  if (screenshotRun) {
    createDemoDatabase(databasePath(dataDir, DEMO_PROFILE), new Date());
    writeProfiles(dataDir, { current: DEMO_PROFILE.id, profiles: [DEMO_PROFILE] });
  }
  // A quit mid-sync can leave a browser profile with bank cookies. Before any
  // sync can run, remove them all. Not on screenshot runs: they hold no lock,
  // so a sync of another running copy could own one.
  if (!screenshotRun) removeLeftoverProfiles();
  openAtStartup(openCurrentDb);
  const sync = createSyncService({
    getDb,
    runSync,
    ingest,
    emit: (progress) => {
      console.log(`[sync] ${progress.provider}: ${progress.stage}`);
      // A sync cancelled by quitting reports after its window is gone.
      if (mainWindow && !mainWindow.isDestroyed()) emit(mainWindow.webContents, "sync:progress", progress);
    },
  });
  app.on("before-quit", quitAfterSync(sync, () => app.quit()));
  const handlers = createHandlers({
    version: app.getVersion(),
    dataDir,
    dev,
    sync,
    getDb,
    openCurrentDb,
    closeDb,
    reloadWindow: () => mainWindow?.webContents.reload(),
    // "Delete everything" (spec 23): what the window kept in Electron's own storage.
    clearWindowStorage: async () => {
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    },
  });
  registerIpc(handlers, (url) => isAppUrl(url, devServerUrl));
  mainWindow = createWindow();
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "CoinLeak",
    backgroundColor: "#FCF7ED",
    autoHideMenuBar: true,
    // The logo for the window and the Linux dock (spec 15). build/ sits next to
    // out/ in the repo, and electron-builder.yml packs build/icon.png into app.asar
    // at the same place (spec 29), so this one path works in both.
    icon: join(here, "../../build/icon.png"),
    webPreferences: {
      preload: join(here, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: dev,
    },
  });
  const shotPath = dev ? process.env["COINLEAK_SCREENSHOT"] : undefined;
  if (shotPath) {
    // Dev aid: `COINLEAK_SCREENSHOT=out.png npm run preview` saves the window and quits.
    win.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        void win.webContents.capturePage().then((img) => {
          writeFileSync(shotPath, img.toPNG());
          app.quit();
        });
      }, Number(process.env["COINLEAK_SCREENSHOT_DELAY"] ?? 1500));
    });
  } else {
    win.once("ready-to-show", () => win.show());
  }
  // Dev aids for screenshots: start on a route, force a theme.
  const route = dev ? (process.env["COINLEAK_START_ROUTE"] ?? "") : "";
  const theme = dev ? process.env["COINLEAK_THEME"] : undefined;
  if (theme === "light" || theme === "dark") nativeTheme.themeSource = theme;
  void win.loadURL(`${devServerUrl ?? `${APP_ORIGIN}/index.html`}${route ? `#${route}` : ""}`);
  return win;
}

app.on("window-all-closed", () => app.quit());
// Not on window-all-closed: a running sync may still be saving what it downloaded.
app.on("will-quit", closeDb);
