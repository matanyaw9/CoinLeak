# Working on CoinLeak

Read `REQUIREMENTS.md` (especially sections 3 and 7) and the spec you were
given in `docs/specs/` before touching code. The spec is the contract: build
what it says, prove it with the tests it lists, stop at its boundary.

## Non-negotiables

- **No bank passwords, ever.** No code path asks for, stores, logs, or
  forwards bank credentials. The user types them into the bank's own page.
- **Nothing leaves the machine** except the sync browser talking to the
  bank's own domains. No telemetry, no fetches, no CDNs, no remote fonts.
- **No secrets or personal data in logs or errors.** Log fixed codes and
  counts only: never transaction text, amounts, account numbers, URLs with
  query strings, or a library's error message. Errors to the window use
  `CodedError` codes from `src/shared/errors.ts`.
- **Money is integer agorot.** Never floats in the database, in core, or
  across IPC. Convert with `toAgorot` at the scraper edge.
- **Layers stay separate.** Business logic and SQL live in `src/core`. Main
  wires core to Electron. The renderer calls `src/renderer/src/lib/api.ts`
  and renders; it never computes totals or holds rules.
- **Never silently drop or hide spending.** Every automatic decision
  (card-bill match, rule, status change) is visible and reversible.
- **User edits win, except for rules the user saves.** Notes and exclusions
  set by the user are never overwritten. A category set by hand is never
  changed by sync; a rule the user saves also changes matching hand-set
  rows (owner, F45), and the editor lists those rows before saving.
- **Do not weaken the window security** in `src/main/security.ts`,
  `policy.ts`, `protocol.ts`, or the `webPreferences` in `src/main/index.ts`.
  Their tests must keep passing.
- **Real data stays out of the repo.** Never commit, print, or paste real
  transactions. Test data is synthetic or scrambled.
- No em dashes anywhere: code, comments, docs, commit messages.

## Before you report done

```
npm run check     # typecheck, lint, tests, build
```

All green, plus every acceptance test in your spec. For UI work, also take
screenshots and look at them (see "Working in the sandbox").

## Working in the sandbox

Commands run inside Claude Code's sandbox. To never wait on a permission
prompt:

- **No `cd` prefixes:** never start a command with `cd <dir>;` or
  `cd <dir> &&`. The shell already starts in your working directory. Use
  paths relative to it, absolute paths, or `git -C <dir>` and
  `npm --prefix <dir>`. A leading `cd` makes every command ask the owner.
- **No inline scripts:** do not run `python3 - <<EOF` or `node -e` to edit
  files. Use the Edit tool, or `sed -i` for one-line changes. Inline
  scripts also make the command ask the owner.
- **Dependencies:** in a fresh worktree, do not run `npm ci`. Link the main
  checkout's packages instead:
  `ln -s /home/matanya/Projects/CoinLeak/node_modules node_modules`.
  Only if your spec allows a new dependency, install it in your worktree
  and say so in your report.
- **Screenshots:** build once, then shoot headless (no display, no socket):
  `npx electron-vite build` then
  `COINLEAK_SCREENSHOT=$PWD/.claude/shots/x.png COINLEAK_START_ROUTE=/transactions COINLEAK_THEME=light COINLEAK_SCREENSHOT_DELAY=3000 npm run shot`.
  A screenshot run always gets a fresh temp folder with only a seeded Demo
  profile (the real app on made-up data); it never opens a real database.
  Run `mkdir -p .claude/shots` first, or the shot hangs. Build and shoot
  from your own worktree, never from the main checkout.
  Save under your worktree's `.claude/shots/` (inside the project, so the
  image can be read); the lead copies the final ones. `--no-sandbox` in
  `npm run shot` is for these demo screenshots only.
- **Temp files:** use `$TMPDIR`, not `/tmp`.
- **No `git push`** and no real bank sync: the lead and the owner do those.

## Scope discipline

- Edit only files your spec lists under "Owns". If you need a change
  elsewhere (for example `src/shared/*`), write the smallest possible
  request in your report instead of making it.
- Do not add dependencies beyond those your spec allows. If you must, add
  with `npm install --before=<date two weeks ago>` and say why.
- Additive changes to `src/shared/types.ts` and `src/shared/ipc.ts` only
  when the spec allows it.
- Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`,
  `chore:`), one logical change per commit, on your own branch.

## Code style

- **Simple first.** Write code a new human developer can read, understand
  and fix on the first pass: plain functions, clear names, no clever
  abstractions, no generic frameworks for one use. When two designs work,
  pick the one with fewer moving parts.
- Short, readable modules. Each file starts with a 1 to 3 line comment on
  what it owns. No doc comments unless the logic is surprising.
- TypeScript strict. No `any` without a comment saying why.
- Tests next to the code as `*.test.ts`, vitest. Core is tested heavily;
  UI lightly.

## Stack notes

- Electron 45, electron-vite 6 (main ESM, preload CJS because sandboxed),
  Vite 8, React 19, TypeScript 6.
- SQLite via `node:sqlite` (`DatabaseSync`). Synchronous API. Use
  `transaction()` from `src/core/db`.
- Tailwind v4 (`@theme` in CSS, no tailwind.config). shadcn/ui on base-ui,
  not Radix: there is no `asChild`, use the `render` prop.
- npm install scripts are disabled (`.npmrc`). After `npm ci`, run
  `npm run setup` to fetch the Electron binary.
- Dev runs use a separate data folder (`CoinLeak-dev`) so they never touch
  real data. `COINLEAK_DATA_DIR` overrides it.
