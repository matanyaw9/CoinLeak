import { describe, expect, it } from "vitest";
import { PAGE_KEYS, SHORTCUTS, dialogEnter, isMenuKey, keyFor, keyLabel, letterOf, shortcutFor, type KeyContext, type KeyPress } from "./shortcuts";

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});
const pc: KeyContext = { mac: false, typing: false, overlay: false };
const mac: KeyContext = { ...pc, mac: true };

describe("keys on the window", () => {
  it("each page letter opens its page", () => {
    expect(PAGE_KEYS.map((k) => [k.key, k.to])).toEqual([
      ["h", "/"],
      ["t", "/transactions"],
      ["c", "/categories"],
      ["u", "/budgets"],
      ["r", "/rules"],
      ["b", "/accounts"],
      ["x", "/trash"],
      ["s", "/settings"],
    ]);
    for (const k of PAGE_KEYS) {
      expect(shortcutFor(press(k.key), pc)).toBe(k.id);
      expect(shortcutFor(press(k.key.toUpperCase()), pc)).toBe(k.id);
    }
  });

  it("resolves every key in the table that the window listens for", () => {
    expect(shortcutFor(press("?", { shiftKey: true, code: "Slash" }), pc)).toBe("help");
    expect(shortcutFor(press("a", { ctrlKey: true }), pc)).toBe("selectAll");
    expect(shortcutFor(press("Escape"), pc)).toBe("clearSelection");
    expect(shortcutFor(press("f", { ctrlKey: true }), pc)).toBe("find");
  });

  it("ignores letters inside a text box, with modifiers, on repeat, and while a dialog is open", () => {
    expect(shortcutFor(press("h"), { ...pc, typing: true })).toBeNull();
    expect(shortcutFor(press("h"), { ...pc, overlay: true })).toBeNull();
    expect(shortcutFor(press("h", { repeat: true }), pc)).toBeNull();
    expect(shortcutFor(press("h", { isComposing: true }), pc)).toBeNull();
    for (const mod of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      expect(shortcutFor(press("h", { [mod]: true }), pc)).toBeNull();
    }
    expect(shortcutFor(press("?", { shiftKey: true }), { ...pc, typing: true })).toBeNull();
  });

  it("leaves Ctrl+A and Esc to a text box and to an open dialog", () => {
    expect(shortcutFor(press("a", { ctrlKey: true }), { ...pc, typing: true })).toBeNull();
    expect(shortcutFor(press("Escape"), { ...pc, typing: true })).toBeNull();
    expect(shortcutFor(press("Escape"), { ...pc, overlay: true })).toBeNull();
  });

  it("keeps Ctrl+F working everywhere, as before", () => {
    expect(shortcutFor(press("f", { ctrlKey: true }), { ...pc, typing: true, overlay: true })).toBe("find");
  });

  it("means Cmd on a Mac and Ctrl elsewhere", () => {
    expect(shortcutFor(press("a", { metaKey: true }), mac)).toBe("selectAll");
    expect(shortcutFor(press("a", { ctrlKey: true }), mac)).toBeNull();
    expect(shortcutFor(press("a", { metaKey: true }), pc)).toBeNull();
    expect(shortcutFor(press("f", { metaKey: true }), mac)).toBe("find");
    expect(shortcutFor(press("a", { ctrlKey: true, shiftKey: true }), pc)).toBeNull();
  });

  it("reads letters by the physical key on a Hebrew layout", () => {
    expect(letterOf(press("י", { code: "KeyH" }))).toBe("h");
    expect(shortcutFor(press("י", { code: "KeyH" }), pc)).toBe("home");
    expect(shortcutFor(press("ש", { code: "KeyA", ctrlKey: true }), pc)).toBe("selectAll");
    expect(letterOf(press("1", { code: "Digit1" }))).toBeNull();
  });

  it("ignores keys that mean nothing", () => {
    expect(shortcutFor(press("q"), pc)).toBeNull();
    expect(shortcutFor(press("Enter"), pc)).toBeNull();
    expect(shortcutFor(press("/"), pc)).toBeNull();
  });

  it("uses no letter twice", () => {
    const letters = SHORTCUTS.flatMap((k) => (k.key && /^[a-z]$/.test(k.key) ? [k.key] : []));
    expect(new Set(letters).size).toBe(letters.length);
    const ids = SHORTCUTS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the window listens for each key once", () => {
    const listened = SHORTCUTS.filter((k) => k.key && !k.listed && k.group !== "dialogs").map((k) => `${k.mod ? "mod+" : ""}${k.key}`);
    expect(new Set(listened).size).toBe(listened.length);
  });
});

// Spec 36: Delete and I on the selected or focused rows, and the keys lists handle themselves.
describe("keys on rows", () => {
  it("Delete moves rows to Trash; Backspace does too, on a Mac only", () => {
    expect(shortcutFor(press("Delete"), pc)).toBe("deleteRows");
    expect(shortcutFor(press("Delete"), mac)).toBe("deleteRows");
    expect(shortcutFor(press("Backspace"), mac)).toBe("deleteRows");
    expect(shortcutFor(press("Backspace"), pc)).toBeNull();
  });

  it("I toggles Ignore, on a Hebrew layout too", () => {
    expect(shortcutFor(press("i"), pc)).toBe("ignoreRows");
    expect(shortcutFor(press("I"), pc)).toBe("ignoreRows");
    expect(shortcutFor(press("ן", { code: "KeyI" }), pc)).toBe("ignoreRows");
  });

  it("Delete and I wait while typing, with a dialog or menu open, and on a held key", () => {
    for (const key of ["Delete", "i"]) {
      expect(shortcutFor(press(key), { ...pc, typing: true })).toBeNull();
      expect(shortcutFor(press(key), { ...pc, overlay: true })).toBeNull();
      expect(shortcutFor(press(key, { repeat: true }), pc)).toBeNull();
    }
    expect(shortcutFor(press("Backspace"), { ...mac, typing: true })).toBeNull();
    expect(shortcutFor(press("Backspace", { repeat: true }), mac)).toBeNull();
  });

  it("Delete and I with Ctrl, Cmd, Alt or Shift are something else", () => {
    for (const mod of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      expect(shortcutFor(press("Delete", { [mod]: true }), pc)).toBeNull();
      expect(shortcutFor(press("i", { [mod]: true }), pc)).toBeNull();
      expect(shortcutFor(press("Backspace", { [mod]: true }), mac)).toBeNull();
    }
  });

  it("leaves the keys a list handles itself to that list", () => {
    for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Tab", "ContextMenu"]) {
      expect(shortcutFor(press(key), pc)).toBeNull();
      expect(shortcutFor(press(key, { shiftKey: true }), pc)).toBeNull();
    }
    expect(shortcutFor(press("F10", { shiftKey: true }), pc)).toBeNull();
  });

  it("lists every row key, with the same Delete for Trash", () => {
    const listed = SHORTCUTS.filter((k) => k.listed).map((k) => k.id);
    expect(listed).toEqual(["listMove", "listJump", "listTab", "rowToggle", "rowExtend", "rowMenu", "deleteForGood", "chartMonth", "chooserTick", "chooserApply"]);
    expect(keyFor("deleteRows", false)).toBe("Delete");
    expect(keyFor("deleteForGood", true)).toBe("Delete");
    expect(keyFor("ignoreRows", false)).toBe("I");
    expect(keyFor("rowToggle", false)).toBe("Space");
    expect(keyFor("rowExtend", false)).toBe("Shift+↑ ↓");
    expect(keyFor("listJump", true)).toBe("Home / End");
  });
});

describe("Enter in a dialog", () => {
  const FOCUS = ["none", "field", "form", "multiline", "ok", "control"] as const;
  const enter = (extra: Partial<KeyPress>, focus: (typeof FOCUS)[number], destructive = false, onMac = false) =>
    dialogEnter(press("Enter", extra), focus, onMac, destructive);

  it("presses OK from the dialog itself or a lone text box", () => {
    expect(enter({}, "none")).toBe("ok");
    expect(enter({}, "field")).toBe("ok");
  });

  it("leaves Enter to a form, a multi-line box and a focused button", () => {
    for (const focus of ["form", "multiline", "ok", "control"] as const) expect(enter({}, focus)).toBeNull();
  });

  it("Ctrl+Enter (Cmd+Enter on a Mac) presses OK from anywhere", () => {
    for (const focus of FOCUS) {
      expect(enter({ ctrlKey: true }, focus)).toBe("ok");
      expect(enter({ metaKey: true }, focus, false, true)).toBe("ok");
    }
    expect(enter({ metaKey: true }, "multiline")).toBeNull();
    expect(enter({ ctrlKey: true }, "multiline", false, true)).toBeNull();
  });

  it("never lets plain Enter press an OK that deletes; Ctrl+Enter still does", () => {
    for (const focus of ["none", "field", "form", "ok"] as const) {
      expect(enter({}, focus, true)).toBe("block");
      expect(enter({ shiftKey: true }, focus, true)).toBe("block");
      expect(enter({ metaKey: true }, focus, true)).toBe("block");
      expect(enter({ ctrlKey: true }, focus, true)).toBe("ok");
    }
    // Enter on a focused Cancel still cancels, and makes a new line in a multi-line box.
    expect(enter({}, "control", true)).toBeNull();
    expect(enter({}, "multiline", true)).toBeNull();
  });

  it("does not press OK twice for a held key", () => {
    expect(enter({ repeat: true }, "none")).toBe("block");
    expect(enter({ ctrlKey: true, repeat: true }, "field", true)).toBe("block");
  });

  it("ignores other keys, Shift or Alt with Enter, and typing in progress", () => {
    expect(dialogEnter(press("a"), "none", false, false)).toBeNull();
    expect(enter({ shiftKey: true }, "none")).toBeNull();
    expect(enter({ altKey: true }, "none")).toBeNull();
    expect(enter({ isComposing: true }, "none")).toBeNull();
  });
});

describe("key labels", () => {
  it("names keys the way the list shows them", () => {
    expect(keyFor("home", false)).toBe("H");
    expect(keyFor("help", false)).toBe("?");
    expect(keyFor("selectAll", false)).toBe("Ctrl+A");
    expect(keyFor("selectAll", true)).toBe("Cmd+A");
    expect(keyFor("clearSelection", false)).toBe("Esc");
    expect(keyFor("dialogSubmit", false)).toBe("Ctrl+Enter");
    expect(keyFor("toggleClick", true)).toBe("Cmd+click");
    expect(keyLabel({ id: "rangeClick", group: "transactions", click: "shift" }, false)).toBe("Shift+click");
  });
});

describe("the row menu from the keyboard (spec 36)", () => {
  it("opens with the menu key or Shift+F10", () => {
    expect(isMenuKey(press("ContextMenu"))).toBe(true);
    expect(isMenuKey(press("ContextMenu", { shiftKey: true }))).toBe(true);
    expect(isMenuKey(press("F10", { shiftKey: true }))).toBe(true);
  });

  it("not with F10 alone, or with Ctrl, Cmd or Alt", () => {
    expect(isMenuKey(press("F10"))).toBe(false);
    expect(isMenuKey(press("F10", { shiftKey: true, ctrlKey: true }))).toBe(false);
    expect(isMenuKey(press("ContextMenu", { altKey: true }))).toBe(false);
    expect(isMenuKey(press("ContextMenu", { metaKey: true }))).toBe(false);
    expect(isMenuKey(press("Enter"))).toBe(false);
  });
});
