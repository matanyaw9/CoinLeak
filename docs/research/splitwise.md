# Splitwise plan (later, after v1)

Status: **plan, not scheduled** (F95). Shared expenses are listed under
"Not in v1" in `REQUIREMENTS.md` ("splits"). This is the plan for when we
pick it up: the problem, where the data comes from, the money model, the
steps (waves), what the owner tests, and four owner decisions that come
first. Written 2026-11-27 by the lead.

**In short:** no scraper needed. Import Splitwise's CSV export into a
Splitwise account (like the Cash wallet) holding, for each shared
expense, what you paid minus your share. Settle-ups are internal, like
card bills. Then categories show your share and roommates paying you
back is not income. A live connection only maybe, later.

## The problem

Roommates share bills. One person pays the whole bill from their bank and
the others pay them back later, usually by Bit or bank transfer. The bank
only sees the cash, so CoinLeak gets three things wrong.

Example month: electricity 600 split three ways, you paid it. Water 300
split three ways, Roommate A paid it. Then A sends you 100 and B sends
you 200 to settle up.

| | Your bank shows | CoinLeak today | The truth |
|---|---|---|---|
| Electricity | -600 | 600 spending | 200 (your third) |
| Water | nothing | 0 | 100 (your third) |
| Bit from A and B | +100, +200 | 300 income | not income: friends paying back |

Over a long time the cash adds up to the truth (you paid 300 net). In any
one month, the categories and the income line are wrong.

## Getting the data: no scraper needed

`israeli-bank-scrapers` covers banks and cards only. Splitwise offers two
official ways out, and there is a third option to test.

| Way | How it works | Good | Bad |
|---|---|---|---|
| **1. CSV file** | On the Splitwise website, each group has "Export as spreadsheet". You drop the file into CoinLeak. | No network, no secrets: fits every rule in `REQUIREMENTS.md` section 3 today. Anyone can do it. | By hand, once per group, now and then. No expense ids, so edits in Splitwise show up as one row gone and one new. |
| **2. Official API** ([dev.splitwise.com](https://dev.splitwise.com/)) | You make a personal key on Splitwise's site and paste it into CoinLeak. The app downloads from `secure.splitwise.com`. | Exact data: who paid, each share, ids, edits and deletes. One click after setup. | Breaks two rules: a stored secret, and the app talking to a non-bank site. Personal, non-commercial use only; every user needs their own key, which is too hard for "an app my mom could use". |
| **3. Sync browser** | Like a bank: you log in on Splitwise's own page in the sync browser, and CoinLeak reads your expenses inside that session. | Same safety story as banks. No stored secret. | Unknown whether it works (needs a test). Signing in with Google would need Google's login pages on the allowlist. |

Third-party "Splitwise extractors" exist as cloud services. They are out:
your data would go through someone else's server.

**Recommendation:** start with the CSV file (way 1). It proves the money
model on your real roommates with no new risk. If importing by hand gets
tiresome, test way 3 next; keep way 2 as a power-user option at most.

## The money model: Splitwise is one more money account

The idea: CoinLeak gets a **Splitwise account**, like the Cash wallet. It
never syncs from a bank. Each Splitwise expense you are part of becomes
one row in it, with **amount = what you paid minus your share**. For the
example month:

| Row | Account | Amount | Category | Counts as |
|---|---|---|---|---|
| Electric company | Bank | -600 | Electricity | spending |
| Electricity (Apartment) | Splitwise | +400 | Electricity | refund: Electricity is now 200 |
| Water (Apartment) | Splitwise | -100 | Water | spending: Water is now 100 |
| Bit from A | Bank | +100 | | internal: a settle-up |
| Payment from A | Splitwise | -100 | | internal |
| Bit from B | Bank | +200 | | internal: a settle-up |
| Payment from B | Splitwise | -200 | | internal |

Result: Electricity 200, Water 100, no fake income. The Splitwise
account's balance is what friends owe you (or you owe them): +400 -100
-100 -200 = 0, settled. Before they pay, the account shows "friends owe
you 300", so nothing is hidden.

Why this shape:

- **Totals and charts do not change.** It uses what the money model
  already has: money in with a spending category is a refund
  (`flowOf` in `src/core/ledger/flow.ts`), settle-ups are internal like
  card bills, and a vanished expense is gone like a pending row.
- **The bank row is not touched.** No linking is needed for the numbers to
  be right; the 600 stays visible exactly as the bank sent it.
- **Reversible.** Trash a Splitwise row, or remove the account, and you
  are back to the bank-only view.
- **Several payers just work**, because only your own paid-minus-share
  counts. The CSV gives exactly that number per person.

Rules for the rows:

1. One row per expense you are part of. Expenses that do not involve you
   are skipped and counted in the import summary ("12 did not involve
   you").
2. **Category**: the first import lists the Splitwise categories it found
   ("Electricity", "Groceries") and you pick a CoinLeak category for each,
   once. Rules also run on the rows. Hand edits win, as everywhere.
3. **Money in from Splitwise is never income.** An unmapped row goes to a
   seeded "Shared (Splitwise)" spending category and waits in Needs
   review, so the worst case is a wrong category, never fake income.
4. **Settle-ups** (Splitwise "payments") are internal on the Splitwise
   side, always.
5. **Store little.** Date, description, group name, your amount, the full
   cost, currency, Splitwise category. Not friends' names or emails.
   Logs: counts only, as everywhere.

## Settle-ups on the bank side

The Bit line from Roommate A is still +100 income on the bank account
until CoinLeak knows it is a settle-up. Same idea as card bills:

- **Match**: a bank row with the same amount as a Splitwise payment, in
  the right direction, within a few days. One to one, closest date first.
  The bank row becomes internal, with a visible "Splitwise settle-up"
  mark and an "Undo" in its menu.
- **No match**: a Bit or transfer row of a likely amount is flagged
  "Maybe a Splitwise settle-up" in Needs review.
- **By hand**: "This is a Splitwise settle-up" in the row menu.

## Edge cases to decide or handle

- **Foreign currency** (a trip in dollars): Splitwise does not convert.
  Proposal: like foreign pending rows today, amount 0 with the original
  amount kept, flagged until you type the shekel amount.
- **Edited or deleted in Splitwise**: each CSV import is the whole group,
  so a row missing from the new file becomes gone (counts nowhere, waits
  in review), and the edited version comes in as new.
- **"Paid back" (spec 33) and Splitwise together count the refund
  twice.** When a money-in row is a Splitwise settle-up, the Paid back
  action should say so instead.
- **Different dates**: the bank pays on the 3rd, the roommate logs it on
  the 30th of the month before. Each row counts on its own date; the
  month may look off by a little. Acceptable.
- **You paid by credit card**: the card row is the spending row; nothing
  else changes.
- **Profiles, backup, CSV export, Delete data**: Splitwise rows are
  ordinary rows in an ordinary account, so these work as they do.

## Steps

0. **Owner decisions** (end of this file). Nothing below starts before.
1. **Test the file (owner, 15 minutes).** Make a test group in Splitwise
   with two made-up friends and a few made-up expenses, including one
   settle-up and one in dollars. Export it. That file is synthetic, so it
   can become the test fixture; check the columns match this note.
2. **Wave A, two specs in parallel:**
   - *Core*: a migration for the Splitwise account kind and the category
     map; a small CSV reader (no new dependency); import with dedup and
     gone; the "Shared (Splitwise)" category; tests with the money example
     above.
   - *Window*: "Import from Splitwise" on Finance accounts (pick the file,
     pick which column is you, map categories), the account's balance,
     a Splitwise badge on rows.
3. **Wave B, one spec:** settle-up matching, the flag, and the row menu
   action; the Paid back warning.
4. **Maybe later:** a live connection, after a one-hour test of way 3.

## What you would test

- Import your apartment group. Electricity and Water show your share for
  a month you know.
- The roommates' Bit transfers no longer show as income.
- Finance accounts shows the same balance as Splitwise's "you are owed".
- Trash one Splitwise row: its category goes back to the bank-only number.

## Decisions for the owner

1. **Count my share** (this note) or keep the bank view and only show
   Splitwise beside it?
2. **CSV file first** (recommended), or wait until a live connection is
   possible?
3. **Foreign-currency expenses**: type the shekel amount yourself
   (recommended), or skip them with a count in the summary?
4. **When**: after the first public version (recommended), since v1 is
   about the bank basics.
