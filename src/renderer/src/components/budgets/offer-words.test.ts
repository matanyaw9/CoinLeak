import { describe, expect, it } from "vitest";
import { money, offerWords, splitPercent } from "./offer-words";

const names = new Map([
  [1, "Groceries & Shop"],
  [2, "Groceries"],
]);
const nameOf = (id: number) => names.get(id) ?? "";

describe("offerWords", () => {
  it("names the parent, its room, and the one raise", () => {
    const words = offerWords({ code: "over_parent", parentId: 2, room: 30000, raises: [{ categoryId: 2, to: 240000 }] }, "Weekly shop", nameOf);
    expect(words).toEqual({ text: "Groceries has ₪300 left for Weekly shop. Raise Groceries to ₪2,400 too?", button: "Raise both" });
  });

  it("lists every further raise, the total last", () => {
    const words = offerWords(
      {
        code: "over_parent",
        parentId: 2,
        room: 0,
        raises: [
          { categoryId: 2, to: 240000 },
          { categoryId: 1, to: 350050 },
          { categoryId: null, to: 1620000 },
        ],
      },
      "Weekly shop",
      nameOf,
    );
    expect(words.text).toBe(
      "Groceries has nothing left for Weekly shop. Raise Groceries to ₪2,400 too? That also raises Groceries & Shop to ₪3,500.50 and the total to ₪16,200.",
    );
    expect(words.button).toBe("Raise all");
  });

  it("speaks of the total for a top budget", () => {
    const words = offerWords({ code: "over_total", room: 300000, raises: [{ categoryId: null, to: 1650000 }] }, "Groceries & Shop", nameOf);
    expect(words.text).toBe("The total has ₪3,000 left for Groceries & Shop. Raise the total to ₪16,500 too?");
  });
});

describe("money and the split percent", () => {
  it("shows agorot only when there are some", () => {
    expect(money(120000)).toBe("₪1,200");
    expect(money(120050)).toBe("₪1,200.50");
  });

  it("is a whole percent of the total, or none without one", () => {
    expect(splitPercent(1300000, 1600000)).toBe(81);
    expect(splitPercent(1700000, 1600000)).toBe(106);
    expect(splitPercent(500, null)).toBeNull();
  });
});
