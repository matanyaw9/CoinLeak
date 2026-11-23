# Handoff: CoinLeak
_Last session: 2026-11-23 · branch: dev · last commit: 177a660 docs: owner tests for waves 10 to 12 and the review fixes_

## Today in one line
Short session: the owner asked for keyboard shortcuts across the app (logged as **F66**). No code written yet. This is the next feature to build.

## What we did
- Pulled `dev` (already up to date) and read the project docs to plan the keyboard work.
- Logged the request as **F66** in `docs/FEATURES.md`.

## The F66 request, in the owner's words (summarized)
1. **Ctrl+A** on Transactions selects all rows.
2. **H** goes to Home, **T** to Transactions.
3. **Confirm dialogs:** Enter (or Ctrl+Enter) = OK, Esc = Cancel.
4. **Shift+click** a row selects every row from the first click to the second.
5. **Ctrl+click** a row adds it to the selection, or removes it if already selected.
6. **Visible hints:** make the shortcuts obvious, for example the key letter underlined, or a key hint (like `H`) shown next to the item or on hover. The owner asked what the standard way is; the lead should propose one.
7. **Rule for the future:** add to `AGENTS.md` that every new feature or way of interacting must also work from the keyboard.

## Where we stopped
- No code changed. Only this handoff and the F66 line in `docs/FEATURES.md`, both committed on `dev` at wrap-up.
- No background processes, no worktrees.
- Some of F66 may exist already: shift-click ranges (F2, spec 11; `toggleRow` in `src/renderer/src/components/transactions/selection.ts`) and select all (F46, spec 20). Not yet checked how they behave today.

## Open questions / decisions for the user
- **F66 hint style:** recommend a small key badge next to sidebar items and buttons (like `H`), plus the shortcut in tooltips, plus a "Keyboard shortcuts" list (opened with `?`). Underlined letters are the old Windows style and clash with Hebrew text later.
- **F66 Enter vs Ctrl+Enter:** Enter is the standard for OK. Ctrl+Enter only matters in dialogs with a text box (Enter there means a new line, or submit).
- **Single-letter keys** (H, T) must not fire while typing in a search box or note. The spec should say so.
- Still open from 11-19:
  - Test the 11-19 fixes and F62 (list in the 11-19 history line and `docs/OWNER-TESTS.md`).
  - F65 refunds design (later).
  - GitHub settings by hand: private vulnerability reporting, Dependabot, secret scanning with push protection, protect `main`.
  - Ship 0.1.0 to the brother as a pre-release?

## Next steps
1. `git pull`, then check what Transactions already does for Ctrl+A, Shift+click and Ctrl+click (read `use-selection.ts`, `selection.ts`, `transaction-row.tsx`; take a screenshot).
2. Agree the hint style and key list with the owner (questions above), then write spec 31 (`docs/specs/31-keyboard.md`) and add F66 to `REQUIREMENTS.md` section 8.
3. Add the keyboard rule to `AGENTS.md` (Code style or Non-negotiables).
4. Build on a `wave13/keyboard` branch from `dev`: one shortcut hook in the renderer (ignores keys while typing), the confirm-dialog keys in `components/ui/dialog.tsx`, the selection changes, the hints. Test the key logic as plain functions.
5. Then the release path from 11-19: owner tests, merge `dev` into `main`, release 0.1.0 (`docs/PUBLISH-CHECKLIST.md`).

## History
- 2026-11-23: short session; F66 keyboard shortcuts requested and logged, next feature.
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
- 2026-11-09 (evening): waves 8 and 9 (specs 20 to 24) merged; F61 chart controls requested.
