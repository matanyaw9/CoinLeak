// Cases ported from Spent (github.com/Shaya16/Spent), src/server/lib/transfers.test.ts,
// with made-up card numbers.

import { describe, expect, it } from "vitest";
import { companyOf, last4, readCardLine } from "./card-patterns";

describe("readCardLine", () => {
  it("reads the card number from a bank charge line", () => {
    expect(readCardLine("חיוב לכרטיס ויזה 4321")).toEqual({ numbers: ["4321"], companies: [] });
  });

  it("keeps the last 4 digits of a longer number", () => {
    expect(readCardLine("חיוב כרטיס 458000123456 4321")?.numbers).toEqual(["3456", "4321"]);
  });

  it("names the company on numberless lines", () => {
    expect(readCardLine("כ.א.ל חיוב")).toEqual({ numbers: [], companies: ["cal"] });
    expect(readCardLine("כאל")?.companies).toEqual(["cal"]);
    expect(readCardLine("העברה לכאל")?.companies).toEqual(["cal"]);
    expect(readCardLine("ישראכרט")?.companies).toEqual(["isracard"]);
    expect(readCardLine("מקס איט פיננסים")?.companies).toEqual(["max"]);
    expect(readCardLine("AMERICAN EXPRESS")?.companies).toEqual(["isracard"]);
    expect(readCardLine("CAL PAYMENT")?.companies).toEqual(["cal"]);
  });

  it("recognizes generic and network wording without a company", () => {
    for (const line of ["תשלום אשראי", "כרטיס אשראי", "חיוב לכרטיס", "VISA", "מאסטרקארד"]) {
      expect(readCardLine(line), line).toEqual({ numbers: [], companies: [] });
    }
  });

  it("treats Discount's pending card aggregate as a card line", () => {
    expect(readCardLine("חיוב זמני למפתח מזומן")).toEqual({ numbers: [], companies: [] });
  });

  it("ignores ordinary bank lines", () => {
    for (const line of ["משיכת שיק:0080000011", "ניכוי מס מניירות ערך-", "משכורת", "העברה בביט", "", "   "]) {
      expect(readCardLine(line), line).toBeNull();
    }
  });

  it("does not see Cal inside another word, such as a person's name", () => {
    expect(readCardLine("העברה למיכאל")).toBeNull();
    expect(readCardLine("מיכאלי בעמ")).toBeNull();
    expect(readCardLine("LOCAL SHOP")).toBeNull();
  });
});

describe("last4 and companyOf", () => {
  it("reads the last 4 digits or nothing", () => {
    expect(last4("4321")).toBe("4321");
    expect(last4("4580-****-****-4321")).toBe("4321");
    expect(last4("12")).toBeNull();
  });

  it("knows Cal is the visaCal provider's company", () => {
    expect(companyOf("visaCal")).toBe("cal");
    expect(companyOf("discount")).toBeNull();
  });
});
