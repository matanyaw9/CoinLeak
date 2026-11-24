import { describe, expect, it } from "vitest";
import { PAGE_KEYS, SHORTCUTS, dialogPressesOk, keyFor, keyLabel, letterOf, shortcutFor, type KeyContext, type KeyPress } from "./shortcuts";

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
});

describe("Enter in a dialog", () => {
  it("presses OK from the dialog itself or a lone text box", () => {
    expect(dialogPressesOk(press("Enter"), "none", false)).toBe(true);
    expect(dialogPressesOk(press("Enter"), "field", false)).toBe(true);
  });

  it("leaves Enter to a form, a multi-line box and a focused button", () => {
    expect(dialogPressesOk(press("Enter"), "form", false)).toBe(false);
    expect(dialogPressesOk(press("Enter"), "multiline", false)).toBe(false);
    expect(dialogPressesOk(press("Enter"), "control", false)).toBe(false);
  });

  it("Ctrl+Enter (Cmd+Enter on a Mac) presses OK from anywhere", () => {
    for (const focus of ["none", "field", "form", "multiline", "control"] as const) {
      expect(dialogPressesOk(press("Enter", { ctrlKey: true }), focus, false)).toBe(true);
      expect(dialogPressesOk(press("Enter", { metaKey: true }), focus, true)).toBe(true);
    }
    expect(dialogPressesOk(press("Enter", { metaKey: true }), "multiline", false)).toBe(false);
    expect(dialogPressesOk(press("Enter", { ctrlKey: true }), "multiline", true)).toBe(false);
  });

  it("ignores other keys and Shift or Alt with Enter", () => {
    expect(dialogPressesOk(press("a"), "none", false)).toBe(false);
    expect(dialogPressesOk(press("Enter", { shiftKey: true }), "none", false)).toBe(false);
    expect(dialogPressesOk(press("Enter", { altKey: true }), "none", false)).toBe(false);
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
