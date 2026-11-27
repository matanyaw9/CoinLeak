// The one place a key press on the window becomes a shortcut (spec 31).
// shortcuts.ts decides what a key means; this hook reads where focus is and
// whether a dialog is open, then calls the handler the caller gave for it.

import { useEffect, useRef } from "react";
import { isMac, shortcutFor, type ShortcutId } from "./shortcuts";

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/** Dialogs and popovers (role dialog), menus and list boxes, from base-ui. */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="combobox"]';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING) !== null;
}

/** Open now, or the key came from inside one that is closing on this very press. */
function isOverlayOpen(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest(OVERLAY)) return true;
  return document.querySelector(OVERLAY) !== null;
}

/** Calls `handlers[id]` for each shortcut pressed. Keys without a handler are left alone. */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const mac = isMac();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const id = shortcutFor(e, { mac, typing: isTyping(e.target), overlay: isOverlayOpen(e.target) });
      const run = id ? latest.current[id] : undefined;
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
