// Keyboard shortcuts (spec 31, F66): the one table of keys, and plain
// functions that decide what a key press means. use-shortcuts.ts listens,
// keyboard-help.tsx lists this same table, so the two never drift.
// Spec 36: Delete and I on rows, and the keys of lists (lib/roving.ts).

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
  | "listMove"
  | "listJump"
  | "listTab"
  | "selectAll"
  | "clearSelection"
  | "rangeClick"
  | "toggleClick"
  | "rowToggle"
  | "rowExtend"
  | "deleteRows"
  | "ignoreRows"
  | "rowMenu"
  | "deleteForGood"
  | "dialogOk"
  | "dialogSubmit"
  | "dialogCancel"
  | "chartMonth"
  | "flowNames"
  | "chooserTick"
  | "chooserApply"
  | "chooserRemove"
  | "budgetMove"
  | "budgetSave"
  | "budgetRevert"
  | "budgetRaise"
  | "budgetCancel";

/** Where a key works. `rows`: the rows of Transactions and of Trash. */
export type ShortcutGroup = "anywhere" | "lists" | "rows" | "transactions" | "trash" | "dialogs" | "charts" | "budgets";

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  /** A lower-case letter, "?", "Escape", "Enter" or "Delete". */
  key?: string;
  /** Held with Ctrl (Cmd on a Mac). */
  mod?: boolean;
  /** A mouse click with Shift, or with Ctrl (Cmd on a Mac). Listed only. */
  click?: "shift" | "mod";
  /** The page a letter opens. */
  to?: string;
  /**
   * Listed only: the window does not listen for it. A list or row handles
   * the key itself (arrows, Space), or another entry already listens for it.
   */
  listed?: true;
  /** How a listed key looks, when it is more than one key: "Home / End". */
  label?: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "home", group: "anywhere", key: "h", to: "/" },
  { id: "transactions", group: "anywhere", key: "t", to: "/transactions" },
  { id: "categories", group: "anywhere", key: "c", to: "/categories" },
  { id: "rules", group: "anywhere", key: "r", to: "/rules" },
  { id: "accounts", group: "anywhere", key: "a", to: "/accounts" },
  { id: "trash", group: "anywhere", key: "x", to: "/trash" },
  { id: "settings", group: "anywhere", key: "s", to: "/settings" },
  { id: "help", group: "anywhere", key: "?" },
  { id: "find", group: "anywhere", key: "f", mod: true },
  { id: "listMove", group: "lists", listed: true, label: "↑ ↓ ← →" },
  { id: "listJump", group: "lists", listed: true, label: "Home / End" },
  { id: "listTab", group: "lists", listed: true, label: "Tab" },
  { id: "selectAll", group: "rows", key: "a", mod: true },
  { id: "clearSelection", group: "rows", key: "Escape" },
  { id: "rangeClick", group: "rows", click: "shift" },
  { id: "toggleClick", group: "rows", click: "mod" },
  { id: "rowToggle", group: "rows", listed: true, label: "Space" },
  { id: "rowExtend", group: "rows", listed: true, label: "Shift+↑ ↓" },
  { id: "deleteRows", group: "transactions", key: "Delete" },
  { id: "ignoreRows", group: "transactions", key: "i" },
  { id: "rowMenu", group: "transactions", listed: true, label: "Menu / Shift+F10" },
  // On Trash the window hears Delete as `deleteRows`, and that page asks to delete for good.
  { id: "deleteForGood", group: "trash", key: "Delete", listed: true },
  { id: "dialogOk", group: "dialogs", key: "Enter" },
  { id: "dialogSubmit", group: "dialogs", key: "Enter", mod: true },
  { id: "dialogCancel", group: "dialogs", key: "Escape" },
  // spec 38: the charts handle these keys themselves.
  { id: "chartMonth", group: "charts", listed: true, label: "← →" },
  { id: "chooserTick", group: "charts", listed: true, label: "Space" },
  { id: "chooserApply", group: "charts", listed: true, label: "Enter" },
  { id: "chooserRemove", group: "charts", listed: true, label: "Delete / Backspace" },
  // spec 45 A: the money flow's names.
  { id: "flowNames", group: "charts", listed: true, label: "↑ ↓ / Enter" },
  // spec 40: the budget boxes and the raise offer on Categories handle these themselves.
  { id: "budgetMove", group: "budgets", listed: true, label: "↑ ↓" },
  { id: "budgetSave", group: "budgets", listed: true, label: "Enter" },
  { id: "budgetRevert", group: "budgets", listed: true, label: "Esc" },
  { id: "budgetRaise", group: "budgets", listed: true, label: "Enter" },
  { id: "budgetCancel", group: "budgets", listed: true, label: "Esc" },
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

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}

/** Ctrl+F, or Cmd+F on a Mac (spec 17). */
export function isFindKey(e: KeyLike, mac: boolean): boolean {
  return e.key.toLowerCase() === "f" && !e.altKey && !e.shiftKey && isMod(e, mac);
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
  // A Mac's "delete" key is Backspace; elsewhere Backspace stays Back.
  if (k.key === "Delete") return !e.shiftKey && (e.key === "Delete" || (mac && e.key === "Backspace"));
  return !e.shiftKey && letterOf(e) === k.key;
}

/** The keys the window listens for: not the dialogs' own, nor keys only listed. */
const LISTENED = SHORTCUTS.filter((k) => k.group !== "dialogs" && !k.listed && k.key !== undefined);

/**
 * What a key press on the window means, or null. Ctrl+F works as before
 * (spec 17), even in a text box. Every other key waits while the user types
 * or a dialog, menu or popover is open, and a held key does not repeat it.
 */
export function shortcutFor(e: KeyPress, ctx: KeyContext): ShortcutId | null {
  if (isFindKey(e, ctx.mac)) return "find";
  if (ctx.typing || ctx.overlay || e.repeat || e.isComposing) return null;
  const k = LISTENED.find((k) => matches(k, e, ctx.mac));
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

/** How a key looks in the list and on badges: "H", "?", "Ctrl+A", "Cmd+Enter", "Delete". */
export function keyLabel(k: Shortcut, mac: boolean): string {
  const mod = mac ? "Cmd" : "Ctrl";
  if (k.label) return k.label;
  if (k.click) return `${k.click === "shift" ? "Shift" : mod}+click`;
  const key = k.key === "Escape" ? "Esc" : k.key && k.key.length === 1 ? k.key.toUpperCase() : (k.key ?? "");
  return k.mod ? `${mod}+${key}` : key;
}

/** The label of one shortcut, for a tooltip or badge. */
export function keyFor(id: ShortcutId, mac: boolean): string {
  const k = SHORTCUTS.find((k) => k.id === id);
  return k ? keyLabel(k, mac) : "";
}

/** Spec 36: the menu key, or Shift+F10, opens the focused row's menu. */
export function isMenuKey(e: KeyPress): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey);
}
