# Status

Where the project stands, for the owner and the next lead session. Update
at the end of every session.

## 2026-11-10

### In `main` (all checks green)

- Foundation: Electron app with no server, sandboxed window, own SQLite
  database per profile (works offline), typed IPC checked at build time,
  fixed error codes, tests for the window security wiring.
- Sync with self-login; Discount and Cal verified live. Every provider in
  the registry with a per-provider allowlist; a profile chooses how far
  back a sync downloads (spec 23).
- Ledger: dedup, card bills counted once, pending rows settle or go
  "gone", transfers to savings, Trash, a cash wallet with rows typed by
  hand, a balance check per bank account (spec 24).
- Rules v2 with known places and starter lists; categories editor;
  essentials and extras.
- Screens: Home for any period (money left this month, hero, spending
  curve, categories, money flow Sankey, category curves, month by month),
  Transactions (search, sort, filters, day subtotals, bulk actions, notes),
  Categories, Rules, Money accounts, Trash, Settings with profiles and a
  Demo profile on made-up data.
- Wave 9 cleanup (spec 25): money math lives in core (day subtotals,
  `left`, the comparison, trend roll-ups); the month-only channels are
  gone; one module owns query keys and refreshes; Undo of Ignore is one
  core call; Home remembers All / Essentials / Extras per profile;
  `docs/ARCHITECTURE.md` added.

### Next

See `docs/BACKLOG.md` and `docs/FEATURES.md`. Open review findings from
`docs/reviews/2026-11-code-health.md`: 5 (split `ledger/queries.ts`),
6 (screenshot aids out of components), 7 (shared validation limits),
10 (group code by domain, not spec), 11 (renderer helper names), and the
small items in 12.

### How to resume

Start Claude Code in `~/Projects/CoinLeak` (so this project's settings and
`CLAUDE.md` load), and say "continue from docs/STATUS.md".
