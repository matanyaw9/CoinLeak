# Code review: wave 15 round 2, 2026-11-27

**Reviewed:** `git diff 22202cf..4841035`, 17 commits, 47 files, +1047 / -444. It covers the lead's fixes from the wave 15 review (restore check, lowering a budget, `settings:set`, CSV guard, private backup temp file, `leftInside` in core, F89 thousands, F90 key `A`, F94 migration 0017), spec 40 A (budgets on Categories, `round2/budgets`), spec 40 B (tick-box chooser, `round2/chooser`), and the lead's last fix commit. No code was changed.
**Checks:** `npm run check` is green: typecheck, lint, 1298 tests in 107 files, build.
**Verdict:** Good to merge into `main` once the owner has tested it. Every finding from the wave 15 review is fixed and tested, both parts follow spec 40, and the four `AGENTS.md` rules hold (details below). One thing is worth the owner's decision first: the chooser quietly adds or drops a parent's own rows. That is how spec 40 B was written, so it is a gap in the spec, not a builder's bug.

Rules checked:
- **No money maths in the window.** `InsideNote` reads `line.leftInside`, `newlyOver` reads `leftInside` and `left`, and the total card hides "Use this" based on a comparison. Only flipping a sign for display is left.
- **Keyboard.** The Categories list is one Tab stop on `useRoving`, with guards so the boxes and buttons in a line can be reached. The chips are a second stop. The budgets group and the chip key are in the `?` list.
- **User edits win.** No path touches notes, exclusions or hand-set categories.
- **Nothing hidden.** A move always saves and then warns.

### Should fix

1. `src/renderer/src/components/home/chooser.ts:75` (`smallest`) and `:60` (`untick`): **a parent's own rows come and go without being ticked.** A category can hold rows itself, not only through its children (D13), and in core a parent id means "its own rows plus everything under it" (`core/ledger/period.ts:110`). Two cases:
   - Say Food holds ₪200 of its own rows and has three children. Tick Groceries, Restaurants and Coffee one by one: `smallest` turns them into `Food`, so the chart now shows ₪200 that no box stands for.
   - Tick Food, then untick only Coffee: the chart gets `[Groceries, Restaurants]`, and Food's own ₪200 drops out without a word.

   Spec 40 B item 1 asks for exactly this collapse, but the result quietly adds or hides spending, which `AGENTS.md` forbids. Fix (the owner decides):
   - Now: when a parent is partly ticked, the Selected row says "<parent>'s own rows are not counted".
   - Later: give such a parent an "Other in <parent>" line in the chooser. That needs the "only this level" filter that is already on the backlog (`docs/BACKLOG.md:15`). Add this case to that backlog line.
2. `REQUIREMENTS.md:227`: **the plan of record has no round 2.** The waves table stops at "wave 15 ... Budgets page (F73)". `CLAUDE.md` says to keep `REQUIREMENTS.md` and the specs true. Add a row: spec 40 (F87, F88, F91), the lead's F89, F90 and F94, and "owner to test, `OWNER-TESTS.md` section 12". In the same commit, `docs/BACKLOG.md:12` still says the move warning "is in spec 40". It is built now, so mark that line done (or delete it).

### Nice to have

1. `src/renderer/src/components/categories/category-line.tsx:134`: **unsure: dragging selected text in a budget box may start a category move.** The whole line is `draggable`, and its `onDragStart` (`pages/categories-page.tsx:121`) does not check where the drag began. In Chromium, a `dragstart` from dragging selected text inside the `<input>` bubbles up to that handler. `setDragging(c)` then lights up the drop targets, and dropping on a group moves the category. Owner test 12.4 checks something close to this. To confirm, select "16,000" in a box and drag the selection onto another group. Fix: in `onDragStart`, `if (e.target !== e.currentTarget) return;` (when the line itself is dragged, the target is the line).
2. `src/renderer/src/components/home/category-curves-card.tsx:172`: the summed line's name button lights up the line only on mouse hover. Add `onFocus={() => setLit(sumLine.key)}` and `onBlur={() => setLit(null)}` so keyboard users see which line Enter will open.
3. `src/renderer/src/components/categories/category-actions.ts:34`: `warnIfNewlyOver` asks main for the whole category list just to get one name, after two plan fetches, all before the move's mutation settles. Read the name from the query cache instead (`client.getQueryData(queryKey("categories:list"))`), or pass in the page's `nameOf`.
4. `src/renderer/src/components/budgets/budget-line.tsx:116`: while the raise offer has focus, Up and Down go to the list (`category-line.tsx:82`) and move to another line, leaving the offer open and its box unsaved. That is harmless, but Esc is the better way out. Either stop the arrow keys in `RaiseOffer.onKeyDown`, or leave it as is and say so in the `?` list's budgets group.

### Good

- **The two must-fixes from the wave 15 review are fixed at the root, with tests that repeat the review's own cases.**
  - Restore: `schemaOf` now compares every schema entry. The renamed `sqlite_stat1` trigger is a test in `backup.test.ts`.
  - Lowering a budget: `budgetProblem` now lets through any value that puts no more under the parent or total than the category does now (`budgets.ts:159`). Both "already over" cases are tested, including the one-agora step back to a refusal.
- **Spec 40 A moves code instead of copying it.** `BudgetLine` takes the category line as children plus its actions, `InsideNote` is exported, and `budgets-page.tsx` is deleted. The move warning is a small pure `newlyOver` with the four cases the spec lists. The move saves even when the plan cannot be read (`category-actions.ts:50`).
- **Spec 40 B keeps the tick rules as pure functions** (`tick`, `untick`, `allBut`, `smallest`), each tested, including "never overlaps, whatever is clicked" and tidying a list saved before this change. `smallest(start)` makes old saved choices fit the new rules when the chooser opens.
- **Migration 0017 is careful.** It runs only on an empty profile with no rules, only on default-shaped rows with no budget and nothing under them. Tests cover a profile with rows, one with a rule, and one with a budget. The Demo creates its own level 3, so screenshots keep their example.

### Not repeated here

Already in `docs/BACKLOG.md`:
- The screenshot hooks in product components, including `useRaiseShot` on every Categories line now.
- The missing "only this level" filter.
- Tab out of the Transactions and Trash lists, still to confirm on a real keyboard.
