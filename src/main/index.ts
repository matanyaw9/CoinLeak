// App entry: hardening, data folder, database, IPC, and the one window.

import { app, BrowserWindow, nativeTheme, session } from "electron";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase, type Db } from "@core/db";
import { ingest } from "@core/ledger";
import { createHandlers } from "./handlers";
import { emit, registerIpc } from "./ipc";
import { runSync } from "./sync";
import { createSyncService } from "./sync-service";
import { isAppUrl, APP_ORIGIN } from "./policy";
import { registerAppScheme, serveAppFiles } from "./protocol";
import { hardenAllWebContents, hardenSession } from "./security";

const dev = !app.isPackaged;
const devServerUrl = dev ? process.env["ELECTRON_RENDERER_URL"] : undefined;
const here = import.meta.dirname;

// Dev runs keep their own data so experiments never touch real data.
if (dev) app.setPath("userData", join(app.getPath("appData"), "CoinLeak-dev"));
const dataDir = process.env["COINLEAK_DATA_DIR"] ?? join(app.getPath("userData"), "data");

app.enableSandbox();
registerAppScheme();
hardenAllWebContents(devServerUrl);

let db: Db | undefined;
let mainWindow: BrowserWindow | undefined;

// Dev screenshot runs skip the single-instance lock: it needs a local socket,
// which sandboxed tooling cannot open. Packaged builds always take the lock.
const screenshotRun = dev && Boolean(process.env["COINLEAK_SCREENSHOT"]);
if (!screenshotRun && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

function start(): void {
  hardenSession(session.defaultSession, devServerUrl);
  serveAppFiles(join(here, "../renderer"));
  db = openDatabase(join(dataDir, "coinleak.db"));
  const sync = createSyncService({
    db,
    runSync,
    ingest,
    emit: (progress) => {
      console.log(`[sync] ${progress.provider}: ${progress.stage}`);
      if (mainWindow) emit(mainWindow.webContents, "sync:progress", progress);
    },
  });
  registerIpc(createHandlers({ db, version: app.getVersion(), dataDir, dev, sync }), (url) =>
    isAppUrl(url, devServerUrl),
  );
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
    // The logo for the window and the Linux dock (spec 15); build/ sits next to out/.
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

app.on("window-all-closed", () => {
  db?.close();
  app.quit();
});
