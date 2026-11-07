// Theme setting (system, light, dark), kept in localStorage and applied as
// the `dark` class on <html>. "system" follows the computer's setting.

import { useSyncExternalStore } from "react";

export type ThemeSetting = "system" | "light" | "dark";
export const THEMES: ThemeSetting[] = ["system", "light", "dark"];

const STORAGE_KEY = "coinleak.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribers = new Set<() => void>();

function readSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolved(setting: ThemeSetting): "light" | "dark" {
  if (setting !== "system") return setting;
  return media().matches ? "dark" : "light";
}

function apply(): void {
  const dark = resolved(readSetting()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  subscribers.forEach((fn) => fn());
}

/** Call once before the first render. */
export function initTheme(): void {
  apply();
  media().addEventListener("change", apply);
}

export function setTheme(setting: ThemeSetting): void {
  try {
    if (setting === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // Storage can be unavailable; the choice still applies until restart.
  }
  apply();
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useTheme(): { setting: ThemeSetting; resolved: "light" | "dark" } {
  const setting = useSyncExternalStore(subscribe, readSetting);
  const isDark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"));
  return { setting, resolved: isDark ? "dark" : "light" };
}
