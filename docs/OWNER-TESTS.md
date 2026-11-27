# Owner tests

Things only the owner can check, because they need a real bank login or a
human eye. Each takes a few minutes. Report results to the lead in the
chat; the printed summaries hold no private data and are safe to paste.

**Before testing new work, restart `npm run dev`** (Ctrl+C, then start it
again). A running dev window reloads its screens when code changes, but the
app behind them keeps the old code, so new buttons can fail until a restart.

## 1. First real login (sync:try)

Checks that self-login works on the live Discount and Cal sites. Nothing
is saved; it only prints counts.

1. Install a browser for syncing (once):
   `sudo dnf install chromium`
2. In `~/Projects/CoinLeak`: `git pull && npm ci && npm run setup`
3. Make sure debug logging is off: `unset DEBUG NODE_DEBUG`
4. `npm run sync:try -- discount`
   - A Chromium window opens with "controlled by automated test
     software" at the top. The address bar shows
     `https://start.telebank.co.il/...`.
   - Log in yourself, including the SMS code, and stay on the account
     home page.
   - The terminal prints "Logged in. Downloading...", the window closes,
     and a summary prints: accounts, rows per account, a date range of
     about a year, pending count, blocked hosts.
   - If Chromium offers to save your password, click No and tell the lead.
   - If it still says "Log in..." 10 seconds after you reach the home
     page, note the shape of the address bar (no numbers) and report it.
5. `npm run sync:try -- visaCal`
   - Click the login button on cal-online and log in in the panel.
   - Expect one line per card, about 18 months back to a month ahead.
   - `BANK_ERROR` right after "Logged in" means the Cal token path
     failed. Report it.
6. Negative checks:
   - Start a run and close the window before logging in: expect
     `Sync failed: LOGIN_CANCELLED`.
   - Start a run and press Ctrl+C: same.
   - After each run, `ls /tmp | grep coinleak-sync` prints nothing.
7. Paste the summary lines, any `Sync failed: <CODE>`, and the blocked
   hosts list for each bank.

## 2. Look and feel

Run `npm run dev`. To look around on made-up data, add the Demo profile in
Settings, Profiles. Say what feels wrong, rough, or missing.
Screenshots with amounts blurred are welcome.

## 3. Wave 6 (periods, transactions tools, categories, sync feel)

Run `npm run dev` (your dev data). About 15 minutes.

1. **Periods.** Top bar picker: try Last 7 days, Last 12 months, This
   year. Home and Transactions both follow. Pick Custom, set any first
   and last day, press "Show these days". Then set the first day after
   the last: a red message, the button stays off.
2. **Bar chart filter.** Home, "Month by month": open the categories
   list, tick Food and one other group. Only those show. Click a colored
   segment to add it. "All spending" goes back.
3. **Home charts.** Hover the pie: one label, nothing covering the slice.
   In the money flow chart, click a group (Food): its own chart opens,
   with Back. "This month vs last month": this month's line stops today.
4. **Transactions.** Sort by amount and by name. Filter by a category, a
   card, and "Spending"; remove a chip with its x. Click a row's category
   to show only that category. Hover a rule-set category: it says which
   rule. Press Ctrl+F: the search box takes the cursor.
5. **Rules change hand-set rows (F45).** Set one transaction's category
   by hand. Make a rule that matches it with a different category. The
   editor lists it under "This rule will also change..."; save; the row
   moves. Then sync: a category you set by hand afterwards stays.
6. **Categories.** New Fuel, Parking, Bars, Vacation, Impulsive buying
   are there. Extras carry a small "EXTRA" badge; the editor has an
   Essential / Extra switch.
7. **Sync.** Sync a bank. While it runs, the button shows the bank, the
   stage and a ticking clock; the panel says to keep the bank window
   open. Stops on done or cancel.
8. **Rules drag.** On a long rules list, drag a rule to the bottom edge:
   the page scrolls.

## 4. Profiles (spec 19)

Run `npm run dev`.

1. The sidebar's bottom card shows "Me". Your data is all there.
2. Settings, Profiles: Add a profile ("Test"). Switch to it from the
   sidebar card: the window reloads, everything is empty. Switch back to
   Me: all your data is back.
3. Add the Demo profile and switch to it: made-up months of data, Sync
   greyed out everywhere. "Reset demo data" brings it back fresh.
4. Rename "Test", then delete it (type its name to confirm). Delete is
   not offered for the profile that is open.

## 5. Wave 8 (specs 20, 21, 22)

Run `npm run dev`. Try the Demo profile first, then your own.

1. **Left this month.** Top of Home: "₪X left for N days: about ₪Y a
   day", with income, spent and moved to savings underneath. The hero's
   "Left so far" and the Transactions bar show the same left (savings
   subtracted). Does that match how you think about "left"?
2. **Essentials vs extras.** Switch All / Essentials / Extras above the
   headline: the headline, curves, donut and bars change; income and the
   money flow do not. Under All, the month bars split into essential,
   extra and neither; "By category" switches back.
3. **Hover.** Hover a bar segment or a legend name: that category lights
   up in every month, the rest fade. Click it: the filter applies.
4. **Select all.** On Transactions, tick the box above the list, then a
   day's box. Select two rows: both boxes show "partly".
5. **Notes.** Add a note from the row's note icon, and another from the
   right-click menu. Search for a word from the note. Clear it.
6. **Cash.** Add cash (top right of the list): money out ₪20 at a cafe,
   then money in ₪100 from family. Edit one, trash it, restore it.
   Money accounts shows the Cash wallet.
7. **ATM.** With real data: after you add any cash row, your ATM
   withdrawals from that month on read "Moved to cash wallet" and leave
   Spent. If one does not, tell the lead its wording (no amounts).
   "Count it as spending" puts it back.
8. **Find.** Ctrl+F on Categories (try a shop name), on Rules (try a
   category name). While searching Rules, dragging is off.
9. **Rule order.** Rules are numbered, "Checked from the top" above
   them; a rule overlapping a higher one says "Also fits N transactions
   that rule X decides". Drag one: a toast says where it went.

## 6. Wave 9 (specs 23, 24)

Restart `npm run dev` first.

1. **Sync range.** Settings, "How far back to sync": switch to "From a
   date", pick a day; the Sync panel shows "Downloads from <day>" under
   each bank. Switch back to "As far as each bank allows".
2. **Balance.** Sync Discount twice (a few hours or a day apart). Money
   accounts shows the balance and, after the second sync, "Adds up" or
   "Doesn't add up". A gap you cannot explain: tell the lead.
3. **Delete, on a test profile only.** Add a profile "Test", switch to
   it, add a cash row. Settings, Danger zone, "Delete this profile's
   data": type DELETE. The row is gone, the profile stays. Do not try
   "Delete everything" on real data unless you mean it; try it in a
   throwaway data folder: `COINLEAK_DATA_DIR=$HOME/coinleak-test npm run dev`.

## 7. Windows 11 VM test (PUBLISH-CHECKLIST section 3)

Run on 2026-11-16 by the owner in a clean Windows 11 VM (quickemu, user-mode
network, no Chrome installed). Installer built on Linux from `dev` at
6d09775 with `npm run dist:win`, version 0.0.1 (SHA-256 `e480a2a7...6d47`),
plus a 0.0.2 build of the same code for the upgrade test (version bump not
committed). Downloaded in Edge from a local web server at
`http://10.0.2.2:8765/`. Fuses and `app.asar` contents checked as in
`docs/RELEASE.md` before the run: all as required.

| Test | Result |
| --- | --- |
| SmartScreen "Windows protected your PC" | **Not shown, inconclusive.** Edge warned on the download (Keep worked), but Windows did not show its blue box. Most likely because `10.0.2.2` is a private address, so Windows treats the file as local network, not internet. Retest from a draft GitHub Release. |
| Installs with no admin prompt; shortcuts with icon | Pass. Desktop and Start menu shortcuts, CoinLeak icon. |
| App opens; window and taskbar icon | Pass. |
| Hebrew text and right-to-left, local fonts | Pass (Demo profile: Hebrew shop names, amounts left to right, app fonts, charts). |
| Data folder at `%APPDATA%\CoinLeak\data` | Pass. The folder is named `coinleak` in lowercase (Electron takes it from `name` in `package.json`); Windows ignores case, so the documented path works. |
| Sync finds Edge on its own, bank login opens | Pass. Discount login page opened in Edge; closing it showed "cancelled". No real login. |
| Close and reopen: data kept | Pass (a new category survived; reopened on the same profile). |
| Install 0.0.2 over 0.0.1: data kept | Pass. No admin prompt, data and Demo profile kept, Installed apps shows one CoinLeak at 0.0.2. |
| Uninstall from Settings, Apps: app gone, data stays | Pass. Reinstalling brought the data back. |
| Delete everything (F52) empties the folder | Pass. Demo file and the test category gone; only a fresh empty `coinleak.db` and `profiles.json` remain. |
| Second Windows user sees no data | Skipped by the owner (optional). |

Found along the way:

- **Cannot add cash on a fresh profile.** With no transactions yet,
  Transactions shows "Nothing here yet" in place of the list, so the
  "Add cash" button is hidden. Not Windows-specific. Needs a fix.
- `npm run dist:win` failed once with "wine process failed" and passed
  when run again.
- Building in a worktree whose `node_modules` is a symlink (as AGENTS.md
  suggests for workers) gives an `app.asar` missing about 5,000 files of
  nested dependencies. Build releases from the main checkout, or from a
  worktree with a real copy of `node_modules`.
- The VM keyboard stopped reaching Windows once (VM window issue, not
  CoinLeak).

## 8. Before 0.1.0: waves 10 to 12 and the code review fixes

Restart `npm run dev` first. Do each item on the Demo profile first (it
has budgets already), then on your own profile.

1. **Saved or overspent (F62).** Home has a card "Saved or overspent":
   one bar per month, green above zero, red below. Hover a bar: income,
   spending, and any money "moved to savings (not counted)". The current
   month says "so far". Click a bar: Transactions opens on that month.
   On your own profile, pick a month you remember: is the number about
   right?
2. **Average month (F63).** On the month-by-month bars, a line marked
   "Avg ₪X"; hover it for "Average of N full months". On the line charts,
   "Compare with" switches between "Last month" and "Average month".
   Switch to Routine, or untick a category: the average changes too.
3. **Budgets (F59).** Categories page: give a spending category a
   monthly budget of "1500". It shows "≈ ₪375 a week". Home's Budgets
   card shows a bar for it; switch "This month" and "This week". A
   category over budget says "₪X over". Click a bar: its transactions
   open.
4. **Amounts with agorot.** Add cash of "12.5": it shows ₪12.50. Set a
   budget of "99.9". Make a rule with amount "58.90", save it, reopen it:
   still 58.90.
5. **Transactions page.** Click a row, then shift-click another: every
   row between is selected. Open a row's "…" menu and try each entry.
   Change a row's category by hand: "Always put X in Y?" appears with
   "Yes, always" and "Make a rule".
6. **New day, optional.** Leave the app open overnight. Next morning,
   without restarting, Home is on the new day and "Last 7 days" on
   Transactions includes today.

Nothing to test for the other two fixes. The startup fix (a broken data
file shows an error, not an invisible app) was tested by the lead; the
chart helper change was checked with screenshots and looks identical.

## 9. Wave 13 (specs 31, 32, 33)

Restart `npm run dev` first (migration 0014 runs on start). Do the
keyboard and paid back items on the Demo profile first, then on your own.

1. **Keys (F66).** Press H, T, C, R, B, X, S: each opens its page, and the
   sidebar shows the key next to each name. Press `?`: the shortcuts list.
   Type "h" in the search box: nothing jumps.
2. **Selecting (F66).** On Transactions: Ctrl+A selects every row shown,
   Esc clears. Click a row's text, Shift+click another: the range is
   selected. Ctrl+click one row: only that one toggles.
3. **Dialogs (F66).** In an ordinary confirm, Enter means OK and Esc
   means Cancel. In a delete dialog (Empty trash, delete a category),
   plain Enter does nothing; Ctrl+Enter confirms. Lead's call for safety:
   say if you want plain Enter there too.
4. **Sort headers (F80).** Click Amount above the list: largest first;
   click again: smallest first. Same for Date (newest, oldest) and
   Description (A to Z, Z to A). The header stays visible while you
   scroll.
5. **Card bills by card number (F75).** On your own profile, after the
   next sync: bank lines that name your Cal
   card's last 4 digits no longer ask "Card bill?". Turn on "Show card
   bills": they are there. Is any line taken that is not a card bill?
6. **Quick sync (F82).** Sync Cal twice. The first is full (it starts
   keeping track now); time the second one. The terminal running
   `npm run dev` prints a `[sync] visaCal mode=quick loginMs=...
   downloadMs=...` line: tell the lead those numbers. On Finance
   accounts, each bank has "Download everything again".
7. **Paid back (F65).** Demo: on Transactions, find the Bit payment from
   a friend: its category tooltip says "Paid back for פיצה שמש". Your own:
   right-click a money-in row, "Paid back for a purchase...", pick the
   purchase. Its category's spending on Home drops by that amount.
   Right-click again: "Not paid back" undoes it.
8. **Investment and savings lists (F76).** Categories or Rules: the
   starter lists offer "Investments" and "Savings". Add them on your own
   profile. Do any of your rows move there that should not?
9. **Small ones.** "Finance accounts" everywhere (F77). New category:
   the emoji suggestions are big (F74).

**Result, 2026-11-25:** the owner passed all nine. Quick Cal sync:
`loginMs=27857 downloadMs=7097 saveMs=30 accounts=6 rows=88`, so the
download takes 7 seconds and the rest is logging in. New requests from
this test: F83 to F86 in `docs/FEATURES.md`.

## 10. Wave 14 (specs 34, 35, 36) and the wave 13 review fixes

Restart `npm run dev` first (migrations 0015 and 0016 run on start). Try
each item on the Demo profile first, then on your own. Screenshots of the
merged app: `.claude/shots/wave14/`.

1. **Three levels (F69).** Categories page: Groceries & Shop › Groceries
   now holds Weekly shop, Top-up and Specialty food; Transportation ›
   Transport holds Bus and Train. Add a category inside a level 2 one.
   Try to put one inside a level 3 one: it is refused with a clear note.
   Move a category that has subcategories: they come along. Delete one
   that still has subcategories: refused until you move them.
2. **Every level is real (F69).** Give a row the category "Groceries"
   itself (not only Weekly shop). Give a level 3 category a budget. On
   Home's money flow click Groceries & Shop, then Groceries: Weekly shop,
   Top-up and "Other in Groceries"; Back goes up one level. Filter
   Transactions by Groceries: the Weekly shop rows are in it.
3. **Picker.** In a row's category picker type "bus": it shows
   "Transportation › Transport › Bus". Arrows move, Enter picks, Esc
   closes.
4. **Routine / Treats gone (F72).** No Routine / Treats on Home, in the
   category editor or on the Categories page.
5. **New names (F70).** Weekly shop, Top-up, Specialty food, Bus, Train,
   Taxi & rides, Tolls, Car repairs, Car insurance, Car license & test
   are the lead's names. Rename any in the app, or tell the lead.
6. **Rule tick boxes (F71).** Open a rule: every matching row has a tick
   box. Untick two, Save: they keep their category. Open the rule again:
   still unticked. Tick one back, Save: it keeps its category and stays
   yours (review fix: ticking back never hands your choice to the rule).
   The list is one Tab stop: Up and Down move, Space ticks.
7. **Rows you sorted by hand, in a rule.** Rows you sorted elsewhere show
   "Set by you" and are ticked: saving moves them to the rule's category
   (F45); untick to keep them. A row you sorted into a subcategory of the
   rule's category (Weekly shop, for a Groceries rule) is never moved
   back up (lead's fix at merge).
8. **Arrow keys in lists (F83).** Category editor: Tab to the emoji grid,
   arrows move, Enter picks; the color grid the same. Transactions: Tab
   lands on one row, Up and Down move, Space selects, Shift+Down extends,
   the Menu key or Shift+F10 opens the row menu. **Please check** that
   Tab leaves the list and Shift+Tab comes back: the agent could not test
   that without a real keyboard.
9. **Delete and I (F84, F85).** Select rows, press Delete: they go to
   Trash with Undo in the toast. Press I: they are ignored; I again:
   counted again. With nothing selected, both act on the focused row.
10. **Trash (F86).** Boxes on each row, the box above the list, Shift and
    Ctrl+click, Ctrl+A, Esc. "Delete N for good" asks first; plain Enter
    does nothing, Ctrl+Enter confirms. The Delete key opens the same
    question. "Empty trash" still works.
11. **Paid back.** The dialog still opens from the row menu. Type a
    purchase's name fast and press Enter at once: it picks that purchase,
    not the one that was first before you typed.
12. **Review fixes.** (a) Link a pay-back, then give that row another
    category by hand: the coin icon goes, and "Not paid back" is no longer
    offered. (b) Quick sync: if you ever "Add back" a card removed from
    syncing, the next Sync of that bank reaches back to that card's last
    sync, so nothing in between is missed.
13. **Wave 14 review fixes** (`docs/reviews/2026-11-25-wave14-review.md`).
    (a) Sort a row into Coffee by hand, make a rule that sets Coffee,
    untick the row, Save; open the rule, tick it back, Save; delete the
    rule: the row is still in Coffee. (b) In a Groceries rule, rows you
    sorted into Weekly shop show "Already here" with no box, and rows a
    higher rule decides show "Higher rule"; neither is counted in
    "Changes N of M". (c) Arrow keys, one Tab stop per list: the Move
    dialog on Categories, the parent list in the category editor, the
    "Move them to" list when deleting a category, and the category list
    on Home's "Spending by category through the month" card.

## 11. Wave 15 (specs 37, 38, 39)

Restart `npm run dev` first. Try each item on the Demo profile first, then
on your own. Screenshots of the merged app: `.claude/shots/wave15/`.
Since round 2 (section 12), items 1 to 3 live on the Categories page and
the Budgets page and `U` are gone.

1. **Budgets page (F73).** Sidebar: Budgets (or press `U`). Set the
   monthly total; next to it "Average income, <months>: ₪X" and "Use this"
   fills the box. The bar says "N% set · ₪X left to split". Each category
   shows "Usually ₪X", what it spent this month, and its budget box with
   "≈ ₪X a week". Up and Down move between boxes, Enter saves, Esc puts the
   saved amount back.
2. **Children never add up to more than the parent.** Give a parent a
   budget, then give a child more than the parent has left: the line asks
   "Raise <parent> to ₪X too?". Raise both raises the parent (and the total
   if needed); Cancel keeps the old amount. Try to lower a parent below
   its children: refused, saying what they add up to. Try to lower the
   total below what the categories add up to: refused the same way.
3. **Budgets elsewhere.** Categories shows "Budget ₪X" or "No budget" as a
   link: it opens the Budgets page at that line. Home's Budgets card has
   "Plan budgets".
4. **Month by month bars click through (F78).** Click a group: it opens
   one level down. Click a bar of a category with subcategories: one more
   level. Click a bar of a category without subcategories: Transactions
   for that month and category. Click a name in the legend: Transactions
   for the whole 12 months, filtered to it (Home keeps that range until
   you change it). Keyboard: Tab to the bars, Left and Right pick a month,
   Enter opens it.
5. **One category chooser (F79).** "Spending by category through the
   month": the button says "Top 5". Open it, type to search (full paths),
   tick three, Apply: one line, the three added up, against last month or
   the average month. No limit. Esc or clicking outside drops the ticks.
   The month by month card's button opens the same chooser.
6. **Backup (F56).** Settings, Backup and export, Back up now: save to
   Documents; the message names the file. The note says the file is not
   encrypted.
7. **Restore.** Restore from backup, pick that file: a new profile
   "Restored <date>" opens with the same transactions, categories, rules,
   notes and budgets, and says to sync once to log in on this computer.
   Your other profile is untouched. Pick a file that is not a backup (any
   PDF): "This is not a CoinLeak backup", and no new profile. The Welcome
   screen (a new empty profile) has "Restore a backup" too.
8. **CSV.** Export CSV and open it in Excel or LibreOffice: Hebrew reads
   right, amounts are numbers, a description starting with `-` or `=`
   shows as text.
9. **Keyboard list.** Press `?`: Budgets (`U`) and a new "Home charts"
   group are listed.

## 12. Wave 15 round 2 (spec 40, lead fixes)

Restart `npm run dev` first. Demo profile first, then your own.
Screenshots of the merged app: `.claude/shots/round2/`.

1. **Budgets on Categories (F87).** Sidebar has no Budgets entry and `U`
   does nothing. Categories, Spending: the total card and split bar sit at
   the top; each line shows its usual month and its budget box. Up and
   Down between boxes, Enter saves, Esc puts it back. Home's "Plan
   budgets" opens Categories.
2. **Raise offer and lowering.** Give a child more than its parent has
   left: "Raise <parent> to ₪X too?" (Enter or Esc). Lowering a budget
   always saves now, even when its parent is already over.
3. **Move warning.** Move a budgeted category into another budgeted group
   so it no longer fits: the move saves, and a message says "<group>'s
   budgets are now ₪X over"; the group's line shows it in red.
4. **Please try with the mouse:** drag a category onto another group, and
   select the digits in a budget box (the line must not start dragging).
5. **Nesting is obvious (F88).** Categories, the category pickers and the
   chart chooser show thin guide lines for each level.
6. **Thousands (F89).** A saved budget shows "16,000", not "16000". The
   same in the manual transaction and rule amount boxes.
7. **Tick-box chooser (F91).** Home, "Spending by category through the
   month", open the chooser: tick a group (all under it ticked), untick one
   child (the group shows a dash, the rest stay ticked), click a ticked
   line (only it unticks). The Selected chips row shows what is chosen; x
   or Delete removes one; Clear all unticks everything, then Apply.
8. **Summed line name.** On that card, the summed line's name is a button:
   Tab to it and press Enter, it opens Transactions as a dot click does.
9. **`A` opens Finance accounts (F90).** `?` lists it, plus the Budgets and
   chooser keys.
10. **New profile, two levels (F94).** Make a new empty profile: Groceries
    and Transport have no Weekly shop, Top-up, Bus or Train under them.
    Your own profile keeps its categories.

## 13. Spec 41: newer rules win, restore choices

Restart `npm run dev` first. Demo profile first.

1. **A new rule goes on top (F92).** Make a rule for a shop another rule
   already sorts: every row has a tick box, and the editor says
   "Overrides <rule> on N rows". Save: it is rule 1 on the Rules page.
   Starter lists you add later go to the bottom. Dragging rules by hand
   works as before.
2. **Hints on the Rules page.** A rule that loses rows to a higher one
   says "<rule> decides N of these rows"; the higher one says "Overrides
   <rule> on N rows".
3. **Set by you.** Ignore one row by hand, then start a "Don't count it"
   rule for that shop: that row shows "Set by you" with no tick box and is
   not in "Changes N of M".
4. **Restore, choose what to keep (F93).** Settings, Back up now. Then
   Restore from backup: "What to bring over" with three tick boxes. Untick
   Transactions and Budgets, Continue, pick the file: a new profile with
   your categories and rules, no transactions, no budgets; the message
   says "Restored: N rules". Restore again with everything ticked: all of
   it is there. Nothing ticked: Continue is greyed out.
5. **Rules dropped, categories stay.** Restore with Rules unticked: rows
   your rules had sorted keep their categories, also after a Sync.

## 14. Wave 16: ready for Windows (spec 42, lead)

Restart `npm run dev` first.

1. **About (F27, F28 step 1).** Settings, scroll to the bottom: "About
   CoinLeak", the version, and three buttons. Tab to each, press Enter:
   "Check for updates" opens the GitHub Releases page in your browser,
   "Report a bug or an idea" a new empty issue, "Star CoinLeak on GitHub"
   the repository. Nothing else opens, and the app window stays.
2. **Chooser note.** Home, the chooser: tick a group, untick one child.
   The Selected row says "<group>'s own rows are not counted".
3. **Budget boxes.** Categories: select the digits in a budget box and
   drag them onto another group: nothing moves. Drag a category by its
   handle: it moves. Type a budget too big for its parent, Enter, then Up,
   Down, Home, End: focus stays on the offer; Esc leaves it.
4. **Restore without transactions** (adds to 13.4): the new profile's
   Finance accounts shows no banks, except one a kept rule is limited to.
5. **Installer.** `npm run dist:win` prints one SHA-256 line and writes
   `release/SHA256SUMS.txt` for this version only. Lead built it at
   8387f66: fuses and `app.asar` as `docs/RELEASE.md` requires.
6. **Windows VM, short re-run** (section 7's list, from a draft GitHub
   pre-release so SmartScreen shows for real): install, open, About
   buttons open Edge, Restore a backup with choices, uninstall keeps the
   data folder.

## 15. Wave 17 (spec 43)

1. **Show all (F61).** Home, Where the money went: open a group, then a
   category inside it. "Back to <group>" goes up one, "Show all" goes to
   the top. Month by month: tick a category, "All spending" brings back
   everything.
2. **Rule undo is exact.** Rules: open a rule in the middle of the list
   that has an unticked row, delete it, press Undo: it is back in the same
   place, sorting the same rows, and the unticked row is still not sorted.
3. **Demo profile.** Rules has one more rule ("Phone", under Bills) and
   the starter banner says it sorts 2. Last month has one savings move you
   ignored by hand.

## 16. Wave 18: whole-code review fixes (spec 44)

1. **Card-bill Undo (must fix).** On a bank line CoinLeak paired with a
   card (a card bill), note the month's spending, click "Count it as
   spending", then Undo in the toast: the line and the total are exactly
   as before. Same with "It is a card bill" on a flagged line.
2. **Money back on Home.** Demo: add ₪300 money in (Transactions, Add
   cash, or a refund) on a category whose group has no spending this
   month. Home: the donut's list shows "₪300 back" and the list adds up to
   the middle; month by month shows it in the legend and the tooltip.
3. **Quit during a sync (Windows).** Start a sync, close CoinLeak on the
   bank's login page: the bank window closes by itself and CoinLeak quits
   within about 20 seconds. In Explorer, `%TEMP%`: no `coinleak-sync-...`
   folder.
4. **Delete a category with a budget.** The dialog says "Its ₪... budget
   goes too."
5. **Risky pattern.** Rules, Advanced, Pattern: `(\d+)+` is refused;
   `netflix|spotify` and `(\d{4}-){3}` work.
6. Notes, cash rows and rule names still save; Ctrl+F still finds.
