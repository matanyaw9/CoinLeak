// The only web pages the app opens (F27, F28): three fixed GitHub addresses,
// opened in the user's own browser, never in the app window. The window names
// one of them; it never sends an address, and nothing about the user goes along.

import { shell } from "electron";
import type { AppLink } from "@shared/types";
import { CodedError } from "@shared/errors";

const REPO = "https://github.com/matanyaw9/CoinLeak";

export const LINKS: Record<AppLink, string> = {
  feedback: `${REPO}/issues/new`,
  star: REPO,
  releases: `${REPO}/releases`,
};

export const isAppLink = (v: unknown): v is AppLink => typeof v === "string" && Object.hasOwn(LINKS, v);

/** Opens one of the fixed pages; anything else is BAD_REQUEST. */
export async function openAppLink(link: unknown, open: (url: string) => Promise<void> = (url) => shell.openExternal(url)): Promise<null> {
  if (!isAppLink(link)) throw new CodedError("BAD_REQUEST");
  await open(LINKS[link]);
  return null;
}
