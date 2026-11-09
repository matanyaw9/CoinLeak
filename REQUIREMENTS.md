# CoinLeak: requirements and plan of record

CoinLeak (working title) is a local-only desktop app for Israeli bank and
credit card accounts. You press Sync, log in to your bank yourself in a
browser window, and the app downloads your transactions into its own
database on your computer. Then you categorize them and look at clear,
friendly charts of where the money goes. It works fully offline except for
the moment of syncing.

This file says *what* and *why*. Specs in `docs/specs/` say *how* for one
piece of work each. `docs/FEATURES.md` is the owner's feature list. `AGENTS.md` holds the rules every agent and human
follows. `docs/HOW-WE-WORK.md` explains the workflow.

Credits: the visual design, money model ideas, and card-bill detection come
from [Spent](https://github.com/Shaya16/Spent) and the matanyaw9 fork, and
the design work in Pocket. Transaction download uses
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers).

## 1. Goals for v1 (the basics)

1. **See all my spending** from my bank and credit cards in one place.
2. **Count every shekel once.** The card bill on the bank statement and the
   card's own purchases are the same money.
3. **Categorize** every transaction quickly, by hand or by a visible rule.
4. **See my tendencies** in beautiful, interactive charts: this month,
   previous months, by category, what changed.
5. **Feel safe**: as safe as logging in to the bank website myself.
6. Eventually **an app my mom could use**: installer, no terminal, no config.

### Not in v1

AI categorization, budgets and targets, loans, investments and savings
pockets, multi-currency accounts, splits, CSV import, sharing data between
people, auto-update, mobile. Each can be added later without redesign.

## 2. Decisions log

Change a decision only by editing this table and the affected specs together.

| #   | Decision |
|-----|----------|
| D1  | New independent repo. Spent and Pocket are sources of ideas and code, credited where code is copied. |
| D2  | TypeScript everywhere, strict mode. One language for scraping, logic, database and UI. |
| D3  | Electron desktop app. No local web server, no open port. The window talks to the app over Electron IPC through a fixed list of typed channels (`src/shared/ipc.ts`). |
| D4  | Windows and Linux are the target platforms. macOS may work but is not tested. |
| D5  | Data lives in one SQLite file the app owns, in the OS user data folder, via Node's built-in `node:sqlite`. No native modules. File is private to the user (0600). |
| D6  | Transactions are downloaded with `israeli-bank-scrapers`, pinned to an exact reviewed version. First banks: Discount (bank) and Cal (cards). More later. |
| D7  | **Self-login.** The user types the bank password into the bank's real login page in a visible browser window. The app never asks for, sees on purpose, stores, or logs a password. Bank 2FA stays on. |
| D8  | The sync browser is a separate Chromium started per sync over a pipe (no debugging port), with a fresh temporary profile that is deleted afterwards, and a request allowlist of the bank's own domains. |
| D9  | The app window never touches the network: only its own files. Enforced in code and tested. |
| D10 | Money is integer agorot everywhere. Floats exist only at the scraper edge and are converted immediately. |
| D11 | Errors crossing to the window are fixed codes with our own text (`src/shared/errors.ts`). Library and bank error text is never shown, logged, or stored. |
| D12 | Look: Spent's warm buttercream and sage theme, warm dark variant, serif numbers, generous whitespace. React, Tailwind v4, shadcn/ui on base-ui, Recharts. |
| D13 | Categories are a two-level tree (category, subcategory). Rules are visible and ordered. Rows the user categorized by hand are never changed by sync; saving a rule also changes the matching hand-set rows, listed in the editor first (F45). |
| D14 | Untracked card bills stay counted. A bank line that looks like a card bill but matches no tracked card counts as spending and is flagged for review. |
| D15 | Supply chain: exact versions, install scripts off by default, new versions only after a two-week cooldown (Electron security patches excepted), scraper diffs reviewed before upgrade. |
| D16 | Built by AI agents, one spec per agent, each in its own git worktree. The lead (Claude in the main session) writes specs, reviews and merges. |
| D17 | English UI first with all strings in one place, so Hebrew can be added. Transaction text is shown as the bank sends it, with `dir="auto"`. |

## 3. Security model

The bar: using CoinLeak must be no riskier than logging in to the bank
website on this laptop.

| Threat | Rule |
|--------|------|
| Stored or leaked bank password | Never collected (D7). No credential fields, tables or settings exist. |
| Phishing | CoinLeak never shows its own password form. If it ever asks for a bank password, it is not CoinLeak. The only place to type it is the bank's page with its real URL visible. |
| Hijacking the live bank session | Sync browser over a pipe, no debugging port (D8). Browser closed and profile deleted right after download. One sync at a time. |
| Data sent somewhere | No AI, no telemetry, no update checks, no remote fonts or images. App window network is blocked (D9). Sync browser may only reach the bank's domains. |
| Leaks through errors and logs | Fixed error codes (D11). Logs never contain transaction text, amounts, account numbers, or library error messages. No failure screenshots. |
| Another program talking to the app | No server and no port (D3). IPC checks every request comes from our own page. |
| Malicious web content in the window | Sandbox, context isolation, no Node in the page, strict CSP, no navigation, no new windows, no webviews, all permissions denied. |
| Data on disk | SQLite file 0600 in a 0700 folder. Full-disk encryption is the user's protection against laptop theft. |
| Malicious dependency | D15. The scraper package is the most trusted piece: pinned and reviewed. |
| Malicious app build | Fuses on packaged builds: no run-as-Node, no `NODE_OPTIONS`, no inspector flags, asar integrity. |

Out of scope: malware already running as the user (it can read the file
and the keyboard either way, same as normal online banking).

## 4. Domain model

Glossary. Use these words in code, UI and docs.

- **Provider**: a bank or card company (`discount`, `visaCal`).
- **Account**: one bank account or one card, from one provider. Cards have a
  `card_mode`: `credit` (all purchases billed once a cycle as one bank line)
  or `debit` (each purchase hits the bank within days as its own line).
- **Transaction**: one row on one account. `amount` in agorot, negative is
  money out. `date` is the purchase or booking date; `processed_date` is
  when a card charge hits the bank. `status` is `pending`, `completed`, or
  `gone` (a pending row a later download no longer contains). A row the
  user trashed keeps its status, gets `trashed_at`, and counts nowhere until
  restored.
- **Category**: two-level tree with a kind (`expense`, `income`, or
  `transfer` for money moved to savings or investments), emoji and color.
- **Rule**: ordered condition (text, account, amount, direction) to action
  (set category, exclude). First match wins per action.
- **Card bill**: the bank line that pays a card. When that card is tracked,
  the bank line is **internal** and the card's own rows are the spending.
- **Flow**: the derived meaning of a row (`spending`, `income`, `refund`,
  `internal`, `excluded`). Never stored, computed by one function or SQL
  fragment in `src/core` that every query reuses.
- **Sync run**: one download from one provider. Rows remember their run.
- **Needs review**: uncategorized, a possible card bill for an untracked
  card, or a gone row. The review list is the user's inbox.

### Money model (v1)

| flow      | when |
|-----------|------|
| trashed   | the user moved the row to Trash (counts nowhere, restorable) |
| gone      | the bank stopped reporting this pending row (counts nowhere) |
| excluded  | the user excluded the row |
| internal  | a bank line matched to a tracked card's bill (or debit charge) |
| transfer  | a row in a transfer category (savings, investments): counts as neither spending nor income (spec 14) |
| refund    | money in with an expense category |
| income    | money in, otherwise |
| spending  | money out, otherwise (including untracked card bills, flagged) |

Monthly story: **income minus spending = what was left.** Pending rows count
and are marked.

## 5. Sync

1. User clicks Sync on a provider.
2. App starts a Chromium with a fresh temporary profile, over a pipe, with
   the bank allowlist active, and opens the bank's login page.
3. User logs in, including 2FA. The app waits for the logged-in page.
4. The scraper's download code runs inside that session.
5. Browser closes, profile is deleted.
6. Rows are normalized (`ScrapedAccount`), deduplicated and saved in one
   database transaction, then card bills are matched and rules run.
7. The window shows what is new.

Timeouts and the user closing the browser end the sync with a fixed error.

### Dedup

Banks report overlapping date ranges, and two identical coffees on the same
day are two rows. Key: `sha256(account | date | amount | description |
installment n/m)` plus a sequence number for identical rows in one download.
A row is new when the download has more copies of a key than the database.
User fields (category, note, excluded, card-bill decisions) are never
overwritten by a sync.

### Pending rows

- A pending row that comes back completed with the same content settles in
  place (status, processed date, identifier).
- **Settle with drift**: a pending row with no exact match pairs with a new
  completed row on the same account with the same description (whitespace
  ignored), same installment and direction, date within 7 days and amount
  within max(10%, 5 ILS). Closest first, one to one. The stored row takes
  the completed values and keeps its user fields; the completed row is not
  added again.
- **Gone**: a pending row inside the download's window that neither matches
  nor settles is marked gone: it counts nowhere and waits in review until
  the user deletes it, or a later download brings it back.
- The window starts at the first day the bank really covered (the
  library's own limit plus one day, never earlier), else the account's
  earliest downloaded day. Spec 04 has the details.
- **Foreign pending purchases** have no shekel amount until they settle:
  amount 0, original amount and currency kept, shown as "$50.00, shekel
  amount when it settles". They settle by original amount in the same
  currency. (Spec 06.)
- A Cal download with no pending rows at all marks nothing gone, because
  that usually means Cal's pending request failed. (Spec 06.)

## 6. Screens (v1)

- **Home**: this month's spending and income, spending curve through the
  month vs last month, spending by category (donut or treemap), what
  changed vs last month, last 12 months by category. Every chart is
  hoverable and clicking opens the matching transactions.
- **Transactions**: dense list grouped by day, search and filters, quick
  category picker, bulk select and categorize, needs-review view.
- **Categories**: manage the tree, emoji, colors; rules list and editor.
- **Money accounts and sync** (named so to tell them apart from the
  computer login): providers, accounts and card mode, last sync,
  Sync buttons with progress.
- **Settings**: theme (system, light, dark), data folder location, backup.

## 7. Architecture

```
src/shared    Types, IPC contract, error codes, money helpers. No Node, no DOM.
src/core      Pure logic + database: ledger, dedup, card bills, flows, queries.
              No Electron. Fully unit tested in plain Node.
src/main      Electron main process: window, security, IPC handlers, sync
              (scraper + sync browser). Thin glue over core.
src/preload   The bridge: exposes window.coinleak with an allowlist.
src/renderer  React UI. Calls IPC only. No business rules, no SQL.
```

Rules: the UI never computes money totals itself; core does. Each IPC
channel is one user intention. Migrations are numbered SQL files; shipped
migrations are never edited.

## 8. Milestones

| Wave | Specs | Delivers |
|------|-------|----------|
| 0 | skeleton (done by lead) | Done. Repo, security baseline, IPC contract, database, CI |
| 1 | `01-sync-self-login`, `02-ledger-core`, `03-ui-shell` | Done. Self-login download for Discount and Cal; schema, dedup, card bills, flows, queries; every screen in Spent's look with demo data, including Home charts |
| 2 | `04-pending-lifecycle`, `05-review-and-real-data`, `06-sync-hardening` | Done. Pending rows settle or go gone, review actions, first-run welcome, card mode, real data end to end (Discount verified live) |
| 3 | `07-rules-core`, `08-all-providers`, `09-rules-screen` | Core and first slices done. Rules engine on every sync, Rules page and editor, all 18 providers researched with generic self-login. Left: provider picker in Accounts and Sync, rules from Transactions |
| 4 | `10-money-accounts`, `11-transactions-workbench`, `12-home-charts` | Add any bank from the app, Money accounts, last sync on hover; Trash, right-click menu, rules from rows, card bills hidden by default; category curves, Today button, chart research |
| 5 | `13-rules-v2`, `14-money-flow`, `15-categories-accounts` | Rules with several conditions, known places and starter lists; transfers to savings and the Sankey chart; Empty trash fix; category editor; remove a money account; app icon |
| 6 | `16-periods-home`, `17-transactions-tools`, `18-categories-sync-feel` | Time periods and custom dates, Home charts, Transactions sort and filter, essential or extra tags, new categories, live sync, rules change hand-set rows (F45) |
| 7 | `19-profiles` | Profiles, each its own database; Demo profile on the real core; renderer demo removed |
| 8 | to write | Daily use: select all, notes, manual transactions with a Cash wallet (F46, F48, F8); search and rule order on Categories and Rules (F47, F50); essentials vs extras on charts and money left per day on Home (F49, F51) |
| 9 | to write | Trust and safety: delete data and sync range (F52, F53); balance check (F54); code-health cleanup |
| 10 | to write | First public version: installer, bug report and feedback, version and update link, backup export, experimental labels, scraper update routine (F55, F27, F28, F56, F57, F1) |
| later | | Debt tracking (F58), budgets (F59), Hebrew UI, pockets, AI helper (opt-in) |

## 9. Open questions

- Several people on one computer: decided 2026-11-08, each person uses
  their own computer login (the app keeps data per login). No in-app
  accounts for now.
- Which Chromium? **Decided (spec 01): the system's Chrome, Chromium or
  Edge**, kept updated by the OS; `COINLEAK_CHROME` overrides. Windows
  always has Edge. Linux users install Chromium from their package manager.
- Credit card cycle matching tolerance (days, rounding) on real data.
