// Cases ported from Spent (github.com/Shaya16/Spent), src/server/lib/transfers.test.ts,
// with made-up card numbers.

import { describe, expect, it } from "vitest";
import { PROVIDERS } from "@shared/providers";
import { companyOf, last4, readCardLine, standaloneNumbers } from "./card-patterns";

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
    expect(readCardLine("AMERICAN EXPRESS")?.companies).toEqual(["amex"]);
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

  it("tells the four card companies apart (spec 08)", () => {
    expect(readCardLine("אמריקן אקספרס")?.companies).toEqual(["amex"]);
    expect(readCardLine("חיוב אמקס")?.companies).toEqual(["amex"]);
    expect(readCardLine("לאמקס")?.companies).toEqual(["amex"]);
    expect(readCardLine("AMEX 1234")).toEqual({ numbers: ["1234"], companies: ["amex"] });
    expect(readCardLine("ISRACARD")?.companies).toEqual(["isracard"]);
    expect(readCardLine("ישרא-כארד")?.companies).toEqual(["isracard"]);
    expect(readCardLine("לאומי קארד")?.companies).toEqual(["max"]);
    expect(readCardLine("LEUMI CARD")?.companies).toEqual(["max"]);
    expect(readCardLine("דיינרס")?.companies).toEqual(["cal"]);
  });

  it("does not see Amex or Leumi Card inside other words or bank names", () => {
    expect(readCardLine("שמקסים")).toBeNull();
    expect(readCardLine("העברה מלאומי")).toBeNull();
    expect(readCardLine("בנק לאומי")).toBeNull();
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

  it("knows the company of each card provider", () => {
    expect(companyOf("visaCal")).toBe("cal");
    expect(companyOf("max")).toBe("max");
    expect(companyOf("isracard")).toBe("isracard");
    expect(companyOf("amex")).toBe("amex");
    expect(companyOf("discount")).toBeNull();
    expect(companyOf("hapoalim")).toBeNull();
  });

  it("gives no bank a card company, and a company line finds its own provider", () => {
    for (const p of PROVIDERS.filter((x) => x.kind === "bank")) expect(companyOf(p.id), p.id).toBeNull();
    for (const [line, provider] of [
      ["כאל", "visaCal"],
      ["מקס איט פיננסים", "max"],
      ["ישראכרט", "isracard"],
      ["אמריקן אקספרס", "amex"],
    ] as const) {
      expect(readCardLine(line)?.companies, line).toEqual([companyOf(provider)]);
    }
  });
});

describe("standaloneNumbers (spec 32)", () => {
  it("finds a run of exactly 4 digits on its own", () => {
    expect(standaloneNumbers("הוראת קבע 1234")).toEqual(["1234"]);
    expect(standaloneNumbers("חיוב לכרטיס ויזה 4321")).toEqual(["4321"]);
    expect(standaloneNumbers("כרטיס XXXX1234")).toEqual(["1234"]);
    expect(standaloneNumbers("כרטיס ****1234 ו 5678")).toEqual(["1234", "5678"]);
  });

  it("never reads digits inside a longer number, a date, an amount or a time", () => {
    for (const text of [
      "אסמכתא 98761234",
      "12345",
      "תשלום 12/2025",
      "תשלום 2025/12",
      "חיוב 2025-12-01",
      "חיוב 01.12.2025",
      "סכום 1234.50",
      "סכום 1,234",
      "סכום 4,1234",
      "שעה 12:1234",
    ]) {
      expect(standaloneNumbers(text), text).toEqual([]);
    }
  });
});
