// Manual check of the sync module without Electron:
//   npm run sync:try -- discount     (or any enabled provider id, e.g. hapoalim)
// You log in yourself in the browser window that opens. Prints counts only.

import { CodedError, ERROR_MESSAGES } from "@shared/errors";
import { ENABLED_PROVIDERS, isEnabledProvider, isProviderId, providerInfo } from "@shared/providers";
import type { SyncStage } from "@shared/types";
import { runSync, type SyncReport } from "../src/main/sync/index";
import { summarize } from "../src/main/sync/summary";

const STAGE_TEXT: Partial<Record<SyncStage, string>> = {
  opening_browser: "Opening the sync browser...",
  waiting_for_login: "Log in to the bank in the browser window (5 minutes). Close the window to cancel.",
  downloading: "Logged in. Downloading...",
};

async function main(): Promise<number> {
  const provider = process.argv[2];
  if (isProviderId(provider) && !isEnabledProvider(provider)) {
    console.error(`${providerInfo(provider).name} is not supported: ${providerInfo(provider).reason ?? ""}`);
    return 2;
  }
  if (!isEnabledProvider(provider)) {
    console.error(`Usage: npm run sync:try -- <provider>\nProviders: ${ENABLED_PROVIDERS.join(", ")}`);
    return 2;
  }
  const info = providerInfo(provider);
  console.log(`${info.name} (${info.status}). The login page opens on ${info.site}.`);
  // Library and puppeteer debug output would print bank data and requests.
  const noisy = ["DEBUG", "NODE_DEBUG"].filter((name) => process.env[name]);
  if (noisy.length) {
    console.error(`Refusing to run with ${noisy.join(" and ")} set: debug logs would print bank data.`);
    return 2;
  }

  const controller = new AbortController();
  process.once("SIGINT", () => {
    console.log("\nCancelling...");
    controller.abort();
  });

  let report: SyncReport = { blockedHosts: {} };
  const started = Date.now();
  try {
    const { accounts } = await runSync(provider, {
      signal: controller.signal,
      onProgress: (stage) => {
        const text = STAGE_TEXT[stage];
        if (text) console.log(text);
      },
      onReport: (r) => {
        report = r;
      },
    });
    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);
    for (const line of summarize(accounts, report.blockedHosts)) console.log(line);
    return 0;
  } catch (e) {
    const code = e instanceof CodedError ? e.code : "UNKNOWN";
    console.error(`Sync failed: ${code}: ${ERROR_MESSAGES[code]}`);
    for (const line of summarize([], report.blockedHosts).slice(1)) console.error(line);
    return 1;
  }
}

process.exitCode = await main();
