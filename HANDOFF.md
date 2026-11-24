# Handoff: CoinLeak
_Last session: 2026-11-25 · branch: dev · last commit: c4f5750 docs: owner feedback F67 to F82 and wave 13 specs 31 to 33_

## Today in one line
Wave 13 is running: three builder agents in herdr tab 2 build specs 31, 32 and 33. Saved mid-session in case usage runs out.

## What we did
- Compared CoinLeak with Sure (`we-promise/sure`, AGPL fork of Maybe Finance). Verdict: it does not fit (no Israeli banks, Rails server plus Docker, saved bank passwords via moneyman), but its budgets UI and the net worth, investments and loans features are what the owner wants next. Ideas only, never code (AGPL vs our MIT).
- Logged the owner's feedback as F67 to F82 in `docs/FEATURES.md` (F56 and F65 got notes). Decisions: categories up to 3 levels, every level real (F69); remove Routine / Treats (F72); a bank line naming a synced card's last 4 digits is that card's bill (F75, D14 updated); no history older than a year for Discount, site and Excel included (F81 closed); Cal sync too slow (new F82).
- `REQUIREMENTS.md`: D13, D14, "Finance accounts", waves 13 to 15 and "later" (F67 net worth) in section 8. `AGENTS.md`: new "Keyboard too" rule.
- Wrote specs `docs/specs/31-keyboard-and-sort-headers.md`, `32-card-bills-and-quick-sync.md`, `33-paid-back-and-small-fixes.md`, committed on `dev` (c4f5750, not pushed).
- Cal slowness cause: the library asks Cal month by month, 18 months back plus one ahead, about 20 calls per card, every sync (`visa-cal.js` L336-363). Spec 32 makes a normal sync start at last sync minus 60 days, with "Download everything again" for a full one.

## Where we stopped
- Three worktrees from `dev` at c4f5750, each with a `claude` session in herdr tab "2" (workspace w1), all on Opus 5.5, permission mode auto:

  | Agent | Pane | Worktree / branch | Spec |
  |-------|------|-------------------|------|
  | keyboard | w1:pJ (left) | `.claude/worktrees/wave13-keyboard`, `wave13/keyboard` | 31: shortcuts, key hints, `?` list, sort headers (F66, F80) |
  | cardbills | w1:pM (right top) | `.claude/worktrees/wave13-cardbills`, `wave13/cardbills` | 32: card bills by last 4, quick sync, timing log (F75, F82) |
  | paidback | w1:pN (right bottom) | `.claude/worktrees/wave13-paidback`, `wave13/paidback` | 33: paid back (migration 0014), investment and savings starter lists, Finance accounts, bigger emojis (F65, F76, F77, F74) |

- All three were working at the time of writing (cardbills had 1 commit, the others 0). Nothing reviewed or merged yet.
- Old merged worktrees from waves 10 to 12 still exist under `.claude/worktrees/`; not cleaned (ask the owner first).
- `npm run dev` runs in tab 1 (pane w1:pK) from the main checkout.

## Dead ends / don't retry
- Fable for agents: the owner is on Claude Pro without usage credits; Fable needs paid credits since 2026-11-16. Use `--model opus`.

## Open questions / decisions for the user
- Owner test: time a real Cal sync before merging spec 32, to compare with the quick sync after.
- Push `dev`? (c4f5750 and this handoff are local only.)
- Still open from earlier: test the 11-19 fixes and F62 (`docs/OWNER-TESTS.md`), GitHub settings by hand, ship 0.1.0 to the brother as a pre-release.

## Next steps
1. `git pull`, then check the agents: `herdr agent list`, and `herdr agent read <name> --source recent-unwrapped --lines 120` for each. If a session died (usage limit), resume it in its pane: `herdr pane run <pane> "claude --continue --model opus --permission-mode auto"`, or in a terminal `cd .claude/worktrees/wave13-<name> && claude --continue`. Their commits are safe on their branches.
2. When each finishes: review its branch against its spec and `AGENTS.md` (`git diff dev...wave13/<name>`), run `npm run check` in its worktree, look at its screenshots in `.claude/worktrees/wave13-<name>/.claude/shots/`, send fixes back with `herdr agent prompt`.
3. Merge into `dev` one at a time, rerun `npm run check` after each (expect small conflicts at the end of `strings.ts`, and in `types.ts`, `ipc.ts`, `handlers.ts`, `queries.ts`). Update FEATURES statuses and `docs/OWNER-TESTS.md` with what the owner should test.
4. Then wave 14 specs: nested categories to 3 levels, new defaults (F70 names still to agree: Weekly shop, Top-up, Specialty food; Transport: Bus, Train, Fuel, Repairs, Car insurance, Parking, Taxi & rides, Tolls, Car license & test), remove Routine / Treats, rule editor tick boxes (F69, F70, F72, F71). Meanwhile write the F67 design note (net worth, investments, loans) for the owner to read before any code.

## History
- 2026-11-25: Sure comparison; feedback F67 to F82 logged and decided; wave 13 specs 31 to 33 started in herdr tab 2 on Opus 5.5.
- 2026-11-23: short session; F66 keyboard shortcuts requested and logged, next feature.
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
