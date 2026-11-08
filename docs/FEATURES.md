# Feature list

The owner's wishes, in the owner's words, with the lead's notes. The lead
moves items into specs when planning a wave and marks them here. Review
findings and bugs live in `docs/BACKLOG.md`; the plan of record is
`REQUIREMENTS.md`.

Status: **idea** (not planned), **planned** (in a wave), **spec NN**
(being built), **done**, **needs decision** (owner to answer).

## Wave 5 candidates

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F9 | Rules: "If" instead of "When"; several conditions joined by AND / OR (for example a list of cafe names) | planned | Needs a rule schema change (a migration): today a rule has one condition. Includes "description contains any of: a list of names", which is how "known cafes" works (see F28). |
| F10, F16 | "Apply to existing transactions" on new rules; "Apply now" button | planned | Today every saved rule already re-runs on all existing transactions, silently. Show "Applied to 23 transactions" after saving, plus "Apply now". |
| F21 | A new rule can also change rows whose category was set by hand | planned | "User edits win" stays the default, so a sync or an old rule never undoes your choice. When saving a rule, the editor says "Also change 4 transactions you categorized by hand?" with the list; you tick it to apply. That counts as "the user explicitly asks". |
| F11 | Categories: rename, change color and emoji, add new, add meta categories (Food, Transport) | planned | The two-level tree already exists in the database; only the editing is missing. |
| F12 | Drag a category from one meta category to another | planned | Same spec as F11. |
| F14 | Home and Transactions: custom from/to date range besides calendar months | planned | Core queries need a date range input, not just a month. |
| F22 | The Income, Spent and Left so far bar also at the top of Transactions | planned | Reuses the Home numbers from core; follows the month or date range shown. |
| F23 | Sorting and filtering in Transactions | planned | Sort by date or amount; filter by category, money account, flow (spending, income, ignored, card bills), pending. Pairs with F14 and F22. |
| F24 | Remove a money account from syncing, keeping its transactions | planned | The account is marked "not synced" (hidden from the Sync panel, its rows stay and count). Can be added back. Deleting its rows too would be a separate, explicit action. |
| F8 | Add a transaction by hand: title, cash or how paid, category, etc. | planned | Needs a "manual" money account (Cash) and a source flag, so a sync never touches or duplicates manual rows. |
| F3 | Money moved to investments or savings is not spending (an option) | planned | A third category kind, *transfer*: counts neither as spending nor income; Home can show "moved to savings". |
| F25 | Budget flow chart | planned | A Sankey diagram of the month: income on the left, flowing into spending categories, transfers to savings and what was left. Ranked 2nd in `docs/research/money-charts.md`. Best after F3, so savings show as their own stream. |
| F26 | CoinLeak logo in the Linux dock instead of the generic one | planned | The app has no icon file at all yet. Needs icon files from the logo, the window icon, and on Wayland a `.desktop` file whose name matches the app, which an installer normally adds. Dev runs get a small helper; the installer spec finishes it. |

## Later

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | Scraper updates: stay current without trusting blindly | planned | Pinned to an exact version (6.12.2), install scripts off. Missing a routine: `npm run scraper:check` lists newer versions at least two weeks old and prints the code diff; the lead reviews it for new network addresses, file or process access, new dependencies or obfuscated code, writes a review note, then upgrades. |
| F27 | "Report a bug / give feedback" and "Star us on GitHub" buttons | idea | The app itself never sends anything. The buttons open a GitHub page in your normal web browser (feedback opens a new issue with a blank template, no data from the app attached). Needs one narrow exception in the window security: open these fixed GitHub addresses externally. Only makes sense once the repo is public. |
| F28 | Updates for people who installed the app | idea | Automatic updates are out of v1 on purpose: an updater is a program that downloads and runs new code, which is exactly the supply-chain risk we avoid. Step 1: Settings shows the version and a "Check for updates" button that opens the GitHub Releases page in the browser; you download the new installer yourself. Step 2 (later, opt-in): signed automatic updates from GitHub Releases. Releases come from tagged versions, not from every push to `main`. |
| F15 | Transactions have an ID | done | Every transaction has a permanent number plus a content hash for dedup. |

## Done

| # | Feature | Where |
|---|---------|-------|
| F2 | Bigger checkboxes, shift-click ranges | spec 11 |
| F4 | Research on charts for the flow of money (`docs/research/money-charts.md`) | spec 12 |
| F5 | Spending through the month per category, one or top 5 | spec 12 |
| F6 | Right click: make a rule, ignore, move to trash | spec 11 |
| F7 | Trash with restore (fix pending: "Empty trash" lets rows come back, see `docs/BACKLOG.md`) | spec 11 |
| F13 | Today button | spec 12 |
| F17 | "Money accounts" | spec 10 |
| F19 | Last sync per money account on hover | spec 10 |
| F20 | Card bills hidden by default, "Show card bills" toggle (instead of auto-trash) | spec 11 |

## Decided

| # | Feature | Decision |
|---|---------|----------|
| F18 | App accounts with password, several people on one computer | (a) for now: each person uses their own computer login; the app keeps data per login. In-app passwords without encrypting the file only look safe. |
| F20 | Card-bill bank lines to Trash automatically | Hidden with a filter instead: an automatic trash would hide a decision that can be wrong. |
| F29 | Rules vs "known places" lists | One mechanism: a rule per category with a list of names ("Cafes: Aroma, Cofix, Landwer"). The UI can show it as the category's "known places"; adding a place from a row appends to that list instead of making a new rule. Lead's reasoning in chat, 2026-11-08. |
