# Feature list

The owner's wishes, in the owner's words, with the lead's notes. The lead
moves items into specs when planning a wave and marks them here. Review
findings and bugs live in `docs/BACKLOG.md`; the plan of record is
`REQUIREMENTS.md`.

Status: **idea** (not planned), **planned** (in a wave), **spec NN**
(being built), **done**, **needs decision** (owner to answer).

## Wave 4 candidates (finish wave 3, quick wins)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F2 | Bigger, nicer checkboxes for selecting transactions | spec 11 | UI only. |
| F6 | Right click on a transaction: make a rule from the business name, trash it, or ignore it | spec 11 | "Ignore" already exists as *exclude* (not counted); it gets the greyed look. "Make a rule" reuses `rules:suggest`. |
| F7 | Trash: see trashed transactions and restore them | spec 11 | New: a `trashed` flag (not a real delete, so a sync never brings the row back as new). Trashed rows count nowhere. Fits "never silently drop": everything is visible in Trash and reversible. |
| F17 | Rename "Accounts" to "Money accounts" | spec 10 | Text only. |
| F19 | Hover over Sync: last sync time per money account | spec 10 | Data exists (`sync_runs`). |
| F13 | "Today" button next to the month arrows | spec 12 | Small. |

## Wave 5 candidates

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F9 | Rules: "If" instead of "When"; several conditions joined by AND / OR (for example a list of cafe names) | planned | Needs a rule schema change (a migration): today a rule has one condition. |
| F10, F16 | "Apply to existing transactions" on new rules; "Apply now" button | needs decision | Today **every saved rule already re-runs on all existing transactions** automatically (your hand-picked categories are never touched). It just does not say so. Proposal: show "Applied to 23 existing transactions" after saving, plus an "Apply now" button for after a sync. |
| F11 | Categories: rename, change color and emoji, add new, add meta categories (Food, Transport) | planned | The two-level tree (meta category, then category) already exists in the database; only the editing is missing. |
| F12 | Drag a category from one meta category to another | planned | Same spec as F11. |
| F14 | Home and Transactions: custom from/to date range besides calendar months | planned | Core queries need a date range input, not just a month. |
| F8 | Add a transaction by hand: title, cash or how paid, category, etc. | planned | Needs a "manual" money account (Cash) and a source flag, so a sync never touches or duplicates manual rows. |
| F3 | Money moved to investments or savings is not spending (an option) | planned | A third category kind, *transfer*, next to expense and income. Rows in a transfer category count neither as spending nor as income, and Home can show "moved to savings" separately. |

## Later

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F4 | Research which charts best show the flow of money | spec 12 | Research only, no code: a report with options (Sankey flow, waterfall, calendar heatmap, and so on) and pictures, for the owner to choose. Can run any time. |
| F5 | Spending through the month per category: pick one category, or see the top categories together | spec 12 | After F4, so it uses the chosen style. |
| F1 | Scraper updates: stay current without trusting blindly | planned | Already pinned to an exact version (6.12.2), install scripts off. Missing: a routine. Proposal: `npm run scraper:check` lists newer versions at least two weeks old and prints the code diff; the lead reviews it for new network addresses, file or process access, new dependencies, or obfuscated code, writes a short review note in `docs/`, then upgrades. Done monthly or when a bank breaks. |
| F15 | Transactions have an ID | done | Every transaction already has a permanent number in the database, plus a content hash for dedup. |

## Needs a decision

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F18 | App accounts with password, "remember me", several people on one computer | decided: (a) for now | See the lead's notes in chat (2026-11-08). A password screen without encrypting the data file only *looks* safe: anyone on the computer can open the file directly. Options: (a) each person uses their own computer login; the app already keeps data per login, at no cost; (b) profiles inside the app without passwords, for convenience; (c) real locking: encrypt the database with a password, which means a new native dependency and "forgot password = data lost". |
| F20 | Card-bill bank lines go to Trash automatically | spec 11, as "hidden by default" | They are already counted zero (*internal*, the card's own purchases are the spending). Trashing them automatically would hide an automatic decision, which breaks the "nothing hidden, everything reversible" rule, and the match can be wrong. Proposal instead: hide internal rows from the list by default, with a "Show card bills" filter. |
