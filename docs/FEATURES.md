# Feature list

The owner's wishes, in the owner's words, with the lead's notes. The lead
moves items into specs when planning a wave and marks them here. Review
findings and bugs live in `docs/BACKLOG.md`; the plan of record is
`REQUIREMENTS.md`.

Status: **idea** (not planned), **planned** (in a wave), **spec NN**
(being built), **done**, **needs decision** (owner to answer).

## Waves 5 to 7

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F9 | Rules: "If" instead of "When"; several conditions joined by AND / OR (for example a list of cafe names) | done (spec 13) | Needs a rule schema change (a migration): today a rule has one condition. Includes "description contains any of: a list of names", which is how "known cafes" works (see F28). |
| F10, F16 | "Apply to existing transactions" on new rules; "Apply now" button | done (spec 13) | Today every saved rule already re-runs on all existing transactions, silently. Show "Applied to 23 transactions" after saving, plus "Apply now". |
| F21 | A new rule can also change rows whose category was set by hand | done (spec 13) | "User edits win" stays the default, so a sync or an old rule never undoes your choice. When saving a rule, the editor says "Also change 4 transactions you categorized by hand?" with the list; you tick it to apply. That counts as "the user explicitly asks". |
| F11 | Categories: rename, change color and emoji, add new, add meta categories (Food, Transport) | done (spec 15) | The two-level tree already exists in the database; only the editing is missing. |
| F12 | Drag a category from one meta category to another | done (spec 15) | Same spec as F11. |
| F14 | Home and Transactions: custom from/to date range besides calendar months | done (spec 16) | Default stays the calendar month; presets for last 7 days, last 30 days, this year, and a custom from/to. Owner, 2026-11-08: wants graphs and rows for the past week or year. |
| F22 | The Income, Spent and Left so far bar also at the top of Transactions | done (spec 17) | Reuses the Home numbers from core; follows the period shown. |
| F23 | Sorting and filtering in Transactions | done (spec 17) | Sort by date, amount or name; filter by category, money account, flow (spending, income, ignored, card bills), pending. |
| F32 | Hover a rule-set category to see which rule set it | done (spec 17) | Owner, 2026-11-08 (item 4). |
| F33 | Ctrl+F searches | done (spec 17) | Transactions already has a search box; Ctrl+F jumps to it (item 5). |
| F34 | Click a transaction's category to show only that category | done (spec 17) | Item 9. The edit button next to it still edits. |
| F35 | The "Always put X in Y?" popup gets an X to close it | done (spec 17) | It still goes away by itself (item 7). |
| F36 | Dragging a rule scrolls the page near the top or bottom edge | done (spec 18) | Item 1. |
| F37 | Essential or extra: every spending category is tagged, so you see where you can cut | done (spec 18) | Owner chose a tag over a "Going out" group, 2026-11-08 (item 2). Groceries, rent, fuel are essential; cafes, restaurants, bars, vacation, impulsive buying are extra. Home shows "Essentials vs extras" in a later spec. |
| F38 | More default categories: Transportation gets Fuel and Parking; Vacation; Impulsive buying; Bars | done (spec 18) | Items 12, 13, 19. Added for existing users too, skipped when a category of that name already exists. |
| F39 | While the bank window is open, CoinLeak shows that the sync is alive and the window must stay open | done (spec 18) | Item 10. |
| F40 | Pie chart hover on Home is messy | done (spec 16) | Item 21: labels and tooltip overlap. |
| F43 | Bar chart: filter to one or more categories to see how they behave across the year | done (spec 16) | Owner, 2026-11-08; several categories at once, 2026-11-09. |
| F44 | This month vs last month line chart: this month's line stops at today | done (spec 16) | Owner, 2026-11-08. |
| F41 | Profiles: separate data per profile, plus mock-data profiles | done (spec 19) | Owner chose in-app profiles, 2026-11-08 (item 11), replacing F18's "one computer login per person". Each profile is its own database file; no passwords; Demo never syncs and is safe for screenshots. Owner, 2026-11-09: there should be no separate "demo app"; mock profiles run the real core on made-up data, replacing `lib/demo.ts` (review finding 1). |
| F45 | A new or edited rule also changes rows you categorized by hand | done (spec 18) | Owner, 2026-11-09: "no need to memorize which transactions I manually changed." Decided 2026-11-09: the rule simply applies, no tick box. The editor lists the hand-set rows it will change before saving. Sync still never changes a hand-set category. |
| F42 | Code health review: simple, modular, readable, easy for a new developer | done (review saved) | Item 14. Findings in `docs/reviews/2026-11-code-health.md`; the lead turns them into a cleanup spec. |
| F24 | Remove a money account from syncing, keeping its transactions | done (spec 15) | The account is marked "not synced" (hidden from the Sync panel, its rows stay and count). Can be added back. Deleting its rows too would be a separate, explicit action. |
| F8 | Add a transaction by hand: title, cash or how paid, category, etc. | planned (wave 8) | Needs a "manual" money account (Cash) and a source flag, so a sync never touches or duplicates manual rows. Owner, 2026-11-09: spending cash and cash received (for example from parents). Decided 2026-11-09: an ATM withdrawal is a move into the Cash wallet (like a card bill, counted once), and the hand-added cash purchases are the spending. |
| F3 | Money moved to investments or savings is not spending (an option) | done (spec 14) | A third category kind, *transfer*: counts neither as spending nor income; Home can show "moved to savings". |
| F25 | Budget flow chart | done (spec 14) | A Sankey diagram of the month: income on the left, flowing into spending categories, transfers to savings and what was left. Ranked 2nd in `docs/research/money-charts.md`. Best after F3, so savings show as their own stream. |
| F30 | Money flow: when a month's spending is more than its income, say so loudly | done (spec 16) | Owner, 2026-11-08: drop the "From savings / earlier months" source node. Instead make "this month you spent more than you earned" stand out (color, wording) so it draws attention. |
| F31 | Money flow: click a group (meta category) to open its own flow chart | done (spec 16) | Owner, 2026-11-08: clicking for example Food expands into a Sankey of Food's categories (Groceries, Restaurants, Cafes), with a way back to the whole month. |
| F26 | CoinLeak logo in the Linux dock instead of the generic one | done (spec 15) | The app has no icon file at all yet. Needs icon files from the logo, the window icon, and on Wayland a `.desktop` file whose name matches the app, which an installer normally adds. Dev runs get a small helper; the installer spec finishes it. |

## Waves 8 to 10 (owner, 2026-11-09)

Wave 8 is daily use, wave 9 trust and safety, wave 10 the first public
version. F8 (manual transactions) is in wave 8.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F46 | Select all transactions from a top checkbox; select all of one day | planned (wave 8) | Item 1. Checkboxes and shift-click exist (F2). |
| F47 | Ctrl+F on Categories searches categories; on Rules searches rules | planned (wave 8) | Item 2. Today Ctrl+F works only in Transactions (F33). |
| F48 | Write a note on a transaction | planned (wave 8) | Item 3. The `note` field, search in notes and "sync never overwrites a note" already exist; only the editing is missing. |
| F49 | Essentials vs extras on the existing Home charts | planned (wave 8) | Item 4, the F37 follow-up: see how essential and extra spending change, not only the total. |
| F60 | Charts: hovering a category highlights it (the others fade), since a click filters to it | planned (wave 8, spec 22) | Owner, 2026-11-09. Bar segments, donut slices, curves, legends, Sankey streams. |
| F50 | Make rule order clear: which rule wins | planned (wave 8) | Item 6. The top rule wins (first match, top to bottom); today one line on the page says so. Number the rules, mark the top as checked first, and show when a lower rule also matched. |
| F51 | Home: money left this month and how many days it covers | planned (wave 8) | Item 7. Decided 2026-11-09: real income received this month minus spending minus money moved to savings, divided by the days left (today included). Built in spec 22; the hero and Transactions "Left" use the same definition. Becomes "budget minus spent" once budgets (F59) exist. |
| F52 | Delete data: this profile's, or everything | planned (wave 9) | Item 8. Decided 2026-11-09: two buttons, "Delete this profile's data" and "Delete everything" (every profile and the profiles list; the app starts fresh). Typed confirmation. Honest wording: every file CoinLeak made is deleted and nothing exists elsewhere, but on SSDs and btrfs old bytes can stay on the disk; disk encryption is the real protection. First move the banks list out of localStorage (BACKLOG, spec 10) so nothing is left behind. |
| F53 | Choose how far back a sync downloads | planned (wave 9) | Item 9. Default stays "as far as the bank allows" (Discount 12 months, Cal 18, Max 48, Leumi 36, Yahav 3); the user can pick a later start. |
| F54 | Balance check: do the numbers add up? | planned (wave 9) | Item 10. Keep a balance per sync per account (today each sync overwrites it); between two syncs, balance change should equal the sum of that account's rows. Bank accounts mostly; cards rarely send a balance. Show matches and gaps, never hide rows. |
| F55 | Installer: install and open like any desktop app | planned (wave 10) | Linux (AppImage or rpm, with the dock icon from F26) and Windows. One new build tool. Windows shows "unknown publisher" without a paid signing certificate; owner decides later. Includes the fuses in `REQUIREMENTS.md` section 3. |
| F56 | Export a copy of my data (backup) | planned (wave 10) | Promised in `REQUIREMENTS.md` section 6, never built. |
| F57 | Banks not tested live are labeled "experimental" in the app | planned (wave 10) | Only Discount and Cal are verified. |

## Later

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F58 | Track debt: how much, due dates, interest, am I ready to pay | idea (after v1) | Owner, 2026-11-09. Cheap first step: card installments ("payment 3 of 12") already show future charges you committed to. Loans and interest are usually not in the bank download. |
| F59 | Monthly budget: did I spend as planned, am I near the red line, does the budget fit my needs | idea (after v1) | Owner, 2026-11-09. Turns F51's "left" into "budget minus spent". |
| F1 | Scraper updates: stay current without trusting blindly | planned | Pinned to an exact version (6.12.2), install scripts off. Missing a routine: `npm run scraper:check` lists newer versions at least two weeks old and prints the code diff; the lead reviews it for new network addresses, file or process access, new dependencies or obfuscated code, writes a review note, then upgrades. |
| F27 | "Report a bug / give feedback" and "Star us on GitHub" buttons | planned (wave 10) | The app itself never sends anything. The buttons open a GitHub page in your normal web browser (feedback opens a new issue with a blank template, no data from the app attached). Needs one narrow exception in the window security: open these fixed GitHub addresses externally. Only makes sense once the repo is public. |
| F28 | Updates for people who installed the app | planned (wave 10, step 1) | Automatic updates are out of v1 on purpose: an updater is a program that downloads and runs new code, which is exactly the supply-chain risk we avoid. Step 1: Settings shows the version and a "Check for updates" button that opens the GitHub Releases page in the browser; you download the new installer yourself. Step 2 (later, opt-in): signed automatic updates from GitHub Releases. Releases come from tagged versions, not from every push to `main`. |
| F15 | Transactions have an ID | done | Every transaction has a permanent number plus a content hash for dedup. |

## Done

| # | Feature | Where |
|---|---------|-------|
| F2 | Bigger checkboxes, shift-click ranges | spec 11 |
| F4 | Research on charts for the flow of money (`docs/research/money-charts.md`) | spec 12 |
| F5 | Spending through the month per category, one or top 5 | spec 12 |
| F6 | Right click: make a rule, ignore, move to trash | spec 11 |
| F7 | Trash with restore; emptied rows never come back | specs 11, 14 |
| F13 | Today button | spec 12 |
| F17 | "Money accounts" | spec 10 |
| F19 | Last sync per money account on hover | spec 10 |
| F20 | Card bills hidden by default, "Show card bills" toggle (instead of auto-trash) | spec 11 |

## Decided

| # | Feature | Decision |
|---|---------|----------|
| F18 | App accounts with password, several people on one computer | Replaced by F41 (owner, 2026-11-08): in-app profiles without passwords, each its own database file, plus a Demo profile. In-app passwords without encrypting the file only look safe, so there are still none. |
| F20 | Card-bill bank lines to Trash automatically | Hidden with a filter instead: an automatic trash would hide a decision that can be wrong. |
| F29 | Rules vs "known places" lists | Agreed with starter lists (spec 13, view in spec 15). One mechanism: a rule per category with a list of names ("Cafes: Aroma, Cofix, Landwer"). The UI can show it as the category's "known places"; adding a place from a row appends to that list instead of making a new rule. Lead's reasoning in chat, 2026-11-08. |
