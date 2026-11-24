// Keyboard shortcuts (spec 31, F66): the one table of keys, and plain
// functions that decide what a key press means. use-shortcuts.ts listens,
// keyboard-help.tsx lists this same table, so the two never drift.

import { isFindKey, type KeyLike } from "@/components/transactions/find";

export type ShortcutId =
  | "home"
  | "transactions"
  | "categories"
  | "rules"
  | "accounts"
  | "trash"
  | "settings"
  | "help"
  | "find"
  | "selectAll"
  | "clearSelection"
  | "rangeClick"
  | "toggleClick"
  | "dialogOk"
  | "dialogSubmit"
  | "dialogCancel";

export type ShortcutGroup = "anywhere" | "transactions" | "dialogs";

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  /** A lower-case letter, "?", "Escape" or "Enter". */
  key?: string;
  /** Held with Ctrl (Cmd on a Mac). */
  mod?: boolean;
  /** A mouse click with Shift, or with Ctrl (Cmd on a Mac). Listed only. */
  click?: "shift" | "mod";
  /** The page a letter opens. */
  to?: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "home", group: "anywhere", key: "h", to: "/" },
  { id: "transactions", group: "anywhere", key: "t", to: "/transactions" },
  { id: "categories", group: "anywhere", key: "c", to: "/categories" },
  { id: "rules", group: "anywhere", key: "r", to: "/rules" },
  { id: "accounts", group: "anywhere", key: "b", to: "/accounts" },
  { id: "trash", group: "anywhere", key: "x", to: "/trash" },
  { id: "settings", group: "anywhere", key: "s", to: "/settings" },
  { id: "help", group: "anywhere", key: "?" },
  { id: "find", group: "anywhere", key: "f", mod: true },
  { id: "selectAll", group: "transactions", key: "a", mod: true },
  { id: "clearSelection", group: "transactions", key: "Escape" },
  { id: "rangeClick", group: "transactions", click: "shift" },
  { id: "toggleClick", group: "transactions", click: "mod" },
  { id: "dialogOk", group: "dialogs", key: "Enter" },
  { id: "dialogSubmit", group: "dialogs", key: "Enter", mod: true },
  { id: "dialogCancel", group: "dialogs", key: "Escape" },
];

export const PAGE_KEYS = SHORTCUTS.filter((k): k is Shortcut & { key: string; to: string } => k.to !== undefined && k.key !== undefined);

export interface KeyPress extends KeyLike {
  /** The physical key, as in "KeyH". */
  code?: string;
  repeat?: boolean;
  isComposing?: boolean;
}

export interface KeyContext {
  mac: boolean;
  /** Focus is in a text box, a list box or editable text. */
  typing: boolean;
  /** A dialog, menu or popover is open. */
  overlay: boolean;
}

/** Ctrl, or Cmd on a Mac, and not both. */
export function isMod(e: KeyLike, mac: boolean): boolean {
  return mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

/**
 * The Latin letter of the key. A Hebrew keyboard layout gives a Hebrew
 * letter in `key`, so then the physical key decides (H is H on both).
 */
export function letterOf(e: KeyPress): string | null {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  const m = /^Key([A-Z])$/.exec(e.code ?? "");
  return m?.[1] ? m[1].toLowerCase() : null;
}

function matches(k: Shortcut, e: KeyPress, mac: boolean): boolean {
  if (e.altKey) return false;
  if (k.mod) return isMod(e, mac) && !e.shiftKey && letterOf(e) === k.key;
  if (e.ctrlKey || e.metaKey) return false;
  if (k.key === "?") return e.key === "?" || (e.code === "Slash" && e.shiftKey);
  if (k.key === "Escape") return e.key === "Escape" && !e.shiftKey;
  return !e.shiftKey && letterOf(e) === k.key;
}

/**
 * What a key press on the window means, or null. Ctrl+F works as before
 * (spec 17), even in a text box. Every other key waits while the user types
 * or a dialog, menu or popover is open, and a held key does not repeat it.
 */
export function shortcutFor(e: KeyPress, ctx: KeyContext): ShortcutId | null {
  if (isFindKey(e, ctx.mac)) return "find";
  if (ctx.typing || ctx.overlay || e.repeat || e.isComposing) return null;
  const k = SHORTCUTS.find((k) => k.group !== "dialogs" && k.key !== undefined && matches(k, e, ctx.mac));
  return k?.id ?? null;
}

/** Where focus is when Enter is pressed in a dialog. */
export type DialogFocus =
  /** The dialog itself or plain text. */
  | "none"
  /** A one-line text box outside a form. */
  | "field"
  /** A box in a form: the browser would submit the form. */
  | "form"
  /** A multi-line box, where Enter is a new line. */
  | "multiline"
  /** The OK button itself. */
  | "ok"
  /** Another button, link, check box or list (Cancel, say): Enter is its own. */
  | "control";

/** "ok" presses the dialog's OK, "block" stops the key, null leaves it to the focused element. */
export type DialogEnter = "ok" | "block" | null;

/**
 * What Enter does in a dialog. Ctrl+Enter (Cmd on a Mac) presses OK from
 * anywhere. Plain Enter presses OK unless focus has its own use for it, and
 * never when OK deletes (`destructive`): there it only works on another
 * focused button, such as Cancel. A held key never presses OK twice. A
 * disabled OK is the caller's to skip.
 */
export function dialogEnter(e: KeyPress, focus: DialogFocus, mac: boolean, destructive: boolean): DialogEnter {
  if (e.key !== "Enter" || e.isComposing) return null;
  if (isMod(e, mac) && !e.altKey && !e.shiftKey) return e.repeat ? "block" : "ok";
  if (focus === "multiline" || focus === "control") return null;
  if (destructive) return "block";
  const plain = !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey;
  if (!plain || focus === "form" || focus === "ok") return null;
  return e.repeat ? "block" : "ok";
}

/** How a key looks in the list and on badges: "H", "?", "Ctrl+A", "Cmd+Enter". */
export function keyLabel(k: Shortcut, mac: boolean): string {
  const mod = mac ? "Cmd" : "Ctrl";
  if (k.click) return `${k.click === "shift" ? "Shift" : mod}+click`;
  const key = k.key === "Escape" ? "Esc" : k.key && k.key.length === 1 ? k.key.toUpperCase() : (k.key ?? "");
  return k.mod ? `${mod}+${key}` : key;
}

/** The label of one shortcut, for a tooltip or badge. */
export function keyFor(id: ShortcutId, mac: boolean): string {
  const k = SHORTCUTS.find((k) => k.id === id);
  return k ? keyLabel(k, mac) : "";
}
