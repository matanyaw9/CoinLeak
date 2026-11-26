# 42 Ready for Windows: About, updates, feedback, and round 2 polish (wave 16)

## Goal

Make CoinLeak easy to download and use on Windows for the owner's friend
(F27, F28 step 1, `docs/PUBLISH-CHECKLIST.md` section 2), and fix the
small things the round 2 review found
(`docs/reviews/2026-11-27-round2-review.md`). Two parts, one agent each,
in parallel. They share only `strings.ts` (append only, each in its own
block).

Already done on `dev` by the lead: the `app:openLink` channel
(`src/main/links.ts`): `call("app:openLink", { link })` with `link`
`"feedback"`, `"star"` or `"releases"` opens that fixed GitHub page in the
browser. The window never sends an address. F57 (experimental labels) was
already built (`provider-tag.tsx`).

Read first: `AGENTS.md`, this spec, then only the files under your part's
Owns and what they import.

## Part A: About CoinLeak in Settings (agent `wave16-about`)

### Owns

- New `src/renderer/src/components/settings/about-section.tsx`
- `src/renderer/src/pages/settings-page.tsx` (add the section, last,
  below the danger zone or above it, whichever reads better)
- `src/renderer/src/lib/api.ts` only if the call needs a helper
- `src/renderer/src/strings.ts`: append in a `// spec 42 A` block

### Build

1. **About CoinLeak** section in Settings:
   - "Version <version>" (from `useAppInfo().version`).
   - "Check for updates" button: opens the Releases page
     (`link: "releases"`). Under it, one line: "Download the newest
     installer and run it. Your data stays."
   - "Report a bug or an idea" button (`"feedback"`). Under it: "Opens a
     new issue on GitHub in your browser. Nothing from the app is sent."
   - "Star CoinLeak on GitHub" button (`"star"`).
   - One line: "CoinLeak is free and open source (MIT)."
2. Buttons are real buttons: Tab reaches each, Enter and Space press it.
   If the call fails, a toast with the usual coded error text.
3. No new channel, no new dependency, no change in `src/main`.

### Tests

- A small test that each button calls `app:openLink` with its fixed name
  (mock `call`), in the style of the other renderer tests.
- `npm run check` green.
- Screenshots, light and dark: Settings scrolled to the About section.

## Part B: round 2 review fixes (agent `wave16-polish`)

### Owns

- `src/renderer/src/components/home/chooser.ts`, `chooser.test.ts`,
  `category-chooser.tsx`, `category-curves-card.tsx`
- `src/renderer/src/components/categories/category-line.tsx`,
  `category-actions.ts`, `src/renderer/src/pages/categories-page.tsx`
  (only the drag start)
- `src/renderer/src/components/budgets/budget-line.tsx`
- `src/renderer/src/lib/shortcuts.ts` (budgets group text only, if item 5
  takes that route)
- `src/renderer/src/strings.ts`: append in a `// spec 42 B` block

### Build (the review's numbers)

1. **Should 1, now part.** When a parent with rows of its own is partly
   ticked in the chooser, the Selected row says "<parent>'s own rows are
   not counted" (one short muted line per such parent). Whether a parent
   has its own rows: use what the chooser already knows; if it does not
   know, say it whenever a parent is partly ticked. Test it in
   `chooser.test.ts` as a pure function.
2. **Nice 1.** In the Categories line's `onDragStart`, ignore drags that
   did not start on the line itself (`if (e.target !== e.currentTarget)
   return;`), so dragging selected digits in a budget box never moves a
   category.
3. **Nice 2.** The summed line's name button lights its line on keyboard
   focus too (`onFocus` / `onBlur`, as on hover).
4. **Nice 3.** `warnIfNewlyOver` reads the category name from the query
   cache (`client.getQueryData(queryKey("categories:list"))`) or from a
   name passed in, instead of fetching the whole list again.
5. **Nice 4.** While the raise offer has focus, Up and Down do nothing
   (stop them in `RaiseOffer`'s key handler), so the offer is never left
   open behind another line.

### Tests

- `chooser.test.ts` for item 1; `npm run check` green.
- Screenshots, light and dark: the chooser with a partly ticked parent
  and its note.

## Both parts

- Own worktree, own branch. Do not merge, push or touch `dev`.
  Conventional commits, one logical change each. Keep it simple.
- **Report** to `.claude/shots/REPORT.md`, at most 30 lines: what you
  built, commits, anything needed outside Owns (exact lines), screenshot
  paths, doubts.
