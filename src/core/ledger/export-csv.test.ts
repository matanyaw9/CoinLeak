// CSV export (spec 39): columns, quoting, Hebrew with a BOM, amounts, formula
// injection, and which rows are in. All data here is made up.

import { describe, expect, it } from "vitest";
import { bank, categoryId, idOf, newDb, NOW, txn } from "@core/testing/ledger";
import type { Db } from "../db";
import { setInternalByUser } from "./card-bills";
import { createCategory } from "./categories";
import { exportTransactionsCsv, shekels } from "./export-csv";
import { ingest } from "./ingest";
import { trashTransactions, updateTransactions } from "./queries";

const HEADER = "Date,Charged on,Account,Description,Amount,Category,Note,Status,Ignored,Card bill,Paid back";

/** A small RFC 4180 reader, to check that what we write reads back the same. */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += ch;
  }
  return rows;
}

/** The rows as records keyed by the header, BOM removed. */
function records(db: Db): Record<string, string>[] {
  const [header, ...rows] = parse(exportTransactionsCsv(db).text.slice(1));
  return rows.map((r) => Object.fromEntries((header ?? []).map((h, i) => [h, r[i] ?? ""])));
}

function newCategory(db: Db, name: string, parentId: number | null): number {
  const made = createCategory(db, { name, kind: "expense", parentId, emoji: null, color: null });
  if (!made.ok) throw new Error(made.problem);
  return made.category.id;
}

function byDescription(db: Db, description: string): Record<string, string> {
  const found = records(db).find((r) => r["Description"] === description);
  if (!found) throw new Error(`no row ${description}`);
  return found;
}

function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-10", amount: -4590, description: "סופר, שופרסל", processedDate: "2026-03-12" }),
        txn({ date: "2026-03-09", amount: 120000, description: 'Say "hi"' }),
        txn({ date: "2026-03-08", amount: 5, description: "Line one\nLine two" }),
        txn({ date: "2026-03-07", amount: -2000, description: "Pending coffee", status: "pending" }),
        txn({ date: "2026-03-06", amount: -3000, description: "Ignored gym" }),
        txn({ date: "2026-03-05", amount: -500000, description: "Card bill" }),
        txn({ date: "2026-03-04", amount: 2500, description: "Paid back by a friend" }),
        txn({ date: "2026-03-03", amount: -700, description: "Trashed snack" }),
        txn({ date: "2026-03-02", amount: -800, description: "Gone pending", status: "pending" }),
      ]),
    ],
    { now: NOW },
  );
  updateTransactions(db, [idOf(db, "Ignored gym")], { excluded: true });
  setInternalByUser(db, [idOf(db, "Card bill")], true);
  db.prepare("UPDATE transactions SET paid_back_for = ? WHERE id = ?").run(
    idOf(db, "סופר, שופרסל"),
    idOf(db, "Paid back by a friend"),
  );
  trashTransactions(db, [idOf(db, "Trashed snack")]);
  db.prepare("UPDATE transactions SET gone_at = ? WHERE id = ?").run(NOW.toISOString(), idOf(db, "Gone pending"));
  return db;
}

describe("exportTransactionsCsv", () => {
  it("writes the columns in order, newest first, with CRLF line ends", () => {
    const { text, rows } = exportTransactionsCsv(ledger());
    expect(text.startsWith(`\uFEFF${HEADER}\r\n`)).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    // Line breaks inside a quoted field stay; every record ends in CRLF.
    expect(text.replace(/"[^"]*"/g, "").split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(true);
    expect(rows).toBe(7);
    const dates = records(ledger()).map((r) => r["Date"]);
    expect(dates).toEqual(["2026-03-10", "2026-03-09", "2026-03-08", "2026-03-07", "2026-03-06", "2026-03-05", "2026-03-04"]);
  });

  it("fills each column for a row", () => {
    const db = ledger();
    const weekly = newCategory(db, "Weekly shop", categoryId(db, "Groceries"));
    updateTransactions(db, [idOf(db, "סופר, שופרסל")], { categoryId: weekly, note: "Note, with comma" });
    expect(byDescription(db, "סופר, שופרסל")).toEqual({
      Date: "2026-03-10",
      "Charged on": "2026-03-12",
      Account: "Discount ··0300",
      Description: "סופר, שופרסל",
      Amount: "-45.90",
      Category: "Food › Groceries › Weekly shop",
      Note: "Note, with comma",
      Status: "completed",
      Ignored: "",
      "Card bill": "",
      "Paid back": "",
    });
    expect(byDescription(db, "Pending coffee")["Status"]).toBe("pending");
    expect(byDescription(db, "Card bill")["Card bill"]).toBe("yes");
    expect(byDescription(db, "Paid back by a friend")["Paid back"]).toBe("yes");
  });

  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    const { text } = exportTransactionsCsv(ledger());
    expect(text).toContain('"סופר, שופרסל"');
    expect(text).toContain('"Say ""hi"""');
    expect(text).toContain('"Line one\nLine two"');
    const db = ledger();
    expect(byDescription(db, 'Say "hi"')["Amount"]).toBe("1200.00");
    expect(byDescription(db, "Line one\nLine two")["Amount"]).toBe("0.05");
  });

  it("starts with a UTF-8 BOM, so Hebrew round trips through the bytes", () => {
    const bytes = Buffer.from(exportTransactionsCsv(ledger()).text, "utf8");
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // TextDecoder drops the BOM, as Excel does.
    const read = parse(new TextDecoder("utf-8").decode(bytes));
    expect(read[0]?.join(",")).toBe(HEADER);
    expect(read[1]?.[3]).toBe("סופר, שופרסל");
  });

  it("writes amounts as plain shekels with two decimals and a dot", () => {
    expect(shekels(-4590)).toBe("-45.90");
    expect(shekels(120000)).toBe("1200.00");
    expect(shekels(5)).toBe("0.05");
    expect(shekels(-5)).toBe("-0.05");
    expect(shekels(0)).toBe("0.00");
    expect(shekels(-123456789)).toBe("-1234567.89");
  });

  it("neutralizes every formula prefix in text fields, and never touches a negative amount", () => {
    const db = newDb();
    const prefixes = ["=", "+", "-", "@", "\t", "\r"];
    ingest(
      db,
      [bank(prefixes.map((p, i) => txn({ date: `2026-03-1${i}`, amount: -4590, description: `${p}SUM(A1)` })))],
      { now: NOW },
    );
    db.exec("UPDATE accounts SET name = '=HYPERLINK(\"x\")'");
    const plus = newCategory(db, "+Extras", null);
    const first = idOf(db, "=SUM(A1)");
    updateTransactions(db, [first], { categoryId: plus, note: "@note" });
    const rows = records(db);
    expect(rows.map((r) => r["Description"]).sort()).toEqual(prefixes.map((p) => `'${p}SUM(A1)`).sort());
    for (const r of rows) {
      expect(r["Amount"]).toBe("-45.90");
      expect(r["Account"]?.startsWith("'=HYPERLINK")).toBe(true);
    }
    const row = rows.find((r) => r["Description"] === "'=SUM(A1)");
    expect(row?.["Category"]).toBe("'+Extras");
    expect(row?.["Note"]).toBe("'@note");
  });

  it("leaves out trashed and gone rows, and keeps ignored ones", () => {
    const rows = records(ledger());
    const names = rows.map((r) => r["Description"]);
    expect(names).not.toContain("Trashed snack");
    expect(names).not.toContain("Gone pending");
    expect(rows.find((r) => r["Description"] === "Ignored gym")?.["Ignored"]).toBe("yes");
  });
});
