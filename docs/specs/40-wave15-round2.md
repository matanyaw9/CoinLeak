# 40 Wave 15 round 2: budgets on Categories, a real tick-box chooser

## Goal

The owner's feedback on wave 15 (F87, F88, F91 in `docs/FEATURES.md`, the
owner's words are there) and what is left of the wave 15 review
(`docs/reviews/2026-11-25-wave15-review.md`). Two parts, one agent each,
in parallel. They share nothing but `strings.ts` (append only, each in its
own block) and `tree-guides.tsx` (use it, do not change it).

Already done on `dev` by the lead (do not redo): review must 1 and 2, nice
2 and 3; core sends `leftInside` on each `BudgetPlanLine` (should 2, core
side); F89 (`shekelText` writes "16,000"; `parseShekels` reads commas);
F90 (`A` opens Finance accounts); F94 (migration 0017);
`components/categories/tree-guides.tsx` (F88's guide lines).

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 7, this spec, then only
the files under your part's Owns and what they import. Do not read other
specs unless this one names them.

## Part A: budgets live on the Categories page (agent `round2-budgets`)

### Owns

- `src/renderer/src/pages/categories-page.tsx`,
  `src/renderer/src/components/categories/**` (not `tree-guides.tsx`),
  `src/renderer/src/components/budgets/**`
- Delete `src/renderer/src/pages/budgets-page.tsx`
- `App.tsx` (remove the `/budgets` route only),
  `components/layout/app-sidebar.tsx` (remove the Budgets entry only),
  `lib/shortcuts.ts` and its test (remove `u`; add a "budgets" group),
  `components/home/budget-card.tsx` (its link only)
- `src/renderer/src/strings.ts`: append in a `// spec 40 A` block; delete
  strings that only the Budgets page used

### Build

1. **F87.** The Spending side of the Categories page shows what the
   Budgets page shows today: the total card at the top, the split bar, and
   on each spending line its usual month and its budget box with the raise
   offer. Reuse the components in `components/budgets/`; move code, do not
   copy it. The plain "Budget ₪1,200" text and `BudgetLink` go. The Income
   side has no budgets. Remove the Budgets page, its route, its sidebar
   entry and the `u` key. Home's Budgets card link ("Plan budgets") opens
   `/categories`. Any other link to `/budgets` now goes to `/categories`
   (search for it).
2. **Keyboard.** The Categories list stays one Tab stop on `lib/roving.ts`
   (F83). Up and Down between budget boxes, Enter saves, Esc puts the
   saved amount back, Enter or Esc on the raise offer: as on the Budgets
   page today. All of them go in the `?` list as a "budgets" group (review
   should 1b), like the "charts" group.
3. **F88 guide lines.** Every category tree line on the Categories page
   and in `tree-choice.tsx` starts with `<TreeGuides depth={depth} />`,
   replacing today's padding-only indent. Rows must have no vertical gap,
   so the lines join. Level 1 lines stay bold.
4. **Review should 2, window side.** `budget-line.tsx` shows "left
   inside" and "over" from `line.leftInside` (negative means over), never
   from `budget - inside`.
5. **Review nice 4.** Hide "Use this" on the total card when the average
   income is 0 or null.
6. **Moving breaks a budget: allow and warn** (owner, 2026-11-25). A move
   on Categories always saves. When it leaves a budget that fitted before
   now over (a line whose `leftInside` turns negative, or the total's
   `left` turns negative), show one toast naming the category ("Food's
   budgets are now ₪200 over") and the line shows its red "over" note as
   it already does. Compare the plan before and after the move; do no
   money maths in the window beyond reading those two fields.
7. **F89 check.** Budget boxes show "16,000" when not being typed in (it
   comes from `shekelText`). While the user types, leave their text alone.

### Tests

- `shortcuts.test.ts`: no `u`, no `/budgets`; the budgets group is listed.
- A small test for the "newly over" comparison (pure function, next to
  the page code), including: nothing over, over before and after (no
  toast), newly over line, newly over total.
- `npm run check` green.
- Screenshots, light and dark, Demo profile, from your worktree:
  Categories with budgets (a parent with budgeted children), the raise
  offer open, the `?` list with the budgets group, a tree picker
  (`tree-choice`) showing guide lines.

## Part B: a category chooser that works like tick boxes (agent `round2-chooser`)

### Owns

- `src/renderer/src/components/home/chooser.ts`, `chooser.test.ts`,
  `category-chooser.tsx`, `curve-selection.ts`, `curve-selection.test.ts`,
  `category-curves-card.tsx`, `trend-card.tsx` (chooser use only)
- `src/renderer/src/strings.ts`: append in a `// spec 40 B` block

### Build

1. **F91, tree tick boxes.** In the chooser:
   - Ticking a parent ticks everything under it. Unticking one child
     leaves its siblings ticked and the parent shows a dash (partly
     ticked). Unticking the parent unticks everything under it. Ticking the
     last unticked child makes the parent ticked again.
   - Clicking a ticked line unticks it. Nothing else changes. (Today it
     selects that line alone: that is the bug the owner hit.)
   - What the chart gets is the smallest list that says the same: a fully
     ticked parent is sent as the parent alone, a partly ticked parent as
     its ticked children. There is never an overlap. Keep today's limit, counted on that list.
   - Write these rules as pure functions in `chooser.ts` and test each one
     there.
2. **Shows what is chosen.** Above the list, a "Selected" row of chips,
   one per entry in the sent list (emoji and name; a chip's x removes it),
   and a "Clear all" button that unticks everything. With nothing chosen
   the chips row says what the chart shows then (today's empty-state
   meaning, unchanged).
3. **F88.** Each chooser line starts with `<TreeGuides depth={depth} />`
   (from `components/categories/tree-guides.tsx`), replacing the padding
   indent.
4. **Keyboard.** The list stays one Tab stop on `lib/roving.ts`: Up and
   Down move, Space ticks or unticks, Enter applies, Esc closes. The chips
   row and Clear all are their own Tab stops after the list; Delete or
   Backspace on a chip removes it. Update the "charts" group in the `?`
   list if a key changed (`lib/shortcuts.ts`: one line per key, nothing
   else in that file).
5. **Review should 1a.** In `category-curves-card.tsx`, the summed line's
   name is a button that does what clicking a dot on the line does
   (`openLine(sumLine)`), with the hint as its title.

### Tests

- `chooser.test.ts`: tick a parent, untick one child (dash), untick the
  parent, tick the last child, click a ticked child (only it unticks),
  the sent list (parent alone; ticked children; no overlap), the limit,
  Clear all.
- `npm run check` green.
- Screenshots, light and dark, Demo profile: the chooser with a partly
  ticked parent and the Selected chips; the curves card with the summed
  line's name.

## Not in this spec (waiting on the owner)

F92 (newer rules win, contradiction hints) and F93 (restore: choose what
to keep) get their own spec once the owner confirms the lead's reading.

## Both parts

- Work in your own worktree on your own branch. Do not merge, push or
  touch `dev`.
- Commit with conventional messages, one logical change per commit.
- Keep it simple: move and reuse code, no new helpers beyond what the spec
  names, no new dependencies.
- **Report** to `.claude/shots/REPORT.md` in your worktree, at most 40
  lines: what you built, commits, anything you could not do or needed
  outside Owns, screenshot paths, doubts. No long explanations.
