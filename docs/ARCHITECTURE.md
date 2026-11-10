# Architecture

A one-page map for a new developer. `REQUIREMENTS.md` section 7 has the
layer rules; this page shows how they fit together.

## The layers

```
src/shared    Types, the IPC contract, error codes, money helpers. No Node, no DOM.
src/core      All logic and SQL: ledger, dedup, card bills, flows, rules, summaries.
src/main      Electron main process: window, security, IPC wiring, sync, profiles.
src/preload   The bridge: `window.coinleak`, only the listed channels.
src/renderer  React screens. Ask, then render. No sums, no rules, no SQL.
```

## The path of a request

Example: Home asks for this month's summary.

1. **Window.** A hook calls `call("summary:period", { from, to })` in
   `src/renderer/src/lib/api.ts`. TanStack Query caches the answer under
   the key `["summary:period", args]` (`lib/query-keys.ts`).
2. **Preload.** `src/preload/index.ts` checks the channel is in `CHANNELS`
   and forwards it with `ipcRenderer.invoke`. Anything else is refused.
3. **Main.** `src/main/ipc.ts` checks the request came from our own page
   (`app://coinleak` or, in dev, the Vite server), calls the handler from
   `src/main/handlers.ts`, and wraps the result as `{ ok, value }` or
   `{ ok: false, error }` with a fixed `CodedError` code. The log line holds
   the channel and code only.
4. **Core.** The handler is one line: `periodSummary(getDb(), args)`. Core
   checks every input (bad input is `BAD_REQUEST`) and runs SQL.
5. **SQLite.** `node:sqlite` (`DatabaseSync`), one file per profile, opened
   by `src/core/db`. Synchronous; group writes with `transaction()`.

Events go the other way (only `sync:progress` today): main calls `emit()`
and the preload passes it to listeners registered with `on()`.

## Adding a channel

1. `src/shared/ipc.ts`: add it to `IpcContract` with a one-line comment,
   and to `CHANNELS`. The build fails if one is missing from `CHANNELS`
   (`EVERY_CHANNEL_LISTED`).
2. `src/shared/types.ts`: any new argument or result types.
3. `src/core/...`: the function, with input checks and tests next to it.
   Export it from the module's `index.ts`.
4. `src/main/handlers.ts`: one line calling core. The `Handlers` type fails
   to compile until every channel has a handler.
5. Window: call it through `lib/api.ts`. For a read, add a hook with
   `queryKey(channel, args)`. For a change, refresh with the right function
   in `lib/query-keys.ts` (`refreshLedger`, `refreshRules`,
   `refreshCategories`, `refreshAccounts`); if a new read shows rows or
   money, add its channel to the matching list there.
6. Errors to the window are `CodedError` codes only, never a library's
   message, never row text, amounts or account numbers.

## Money: LEDGER_SQL and flows

Money is integer agorot everywhere (`toAgorot` at the scraper edge).

Every row has one **flow** (`Flow` in `src/shared/types.ts`), decided in
`src/core/ledger/flow.ts`:

| Flow | Counts as |
| --- | --- |
| `spending` | spending |
| `refund` | money back on an expense category; lowers spending |
| `income` | income |
| `transfer` | moved to or from savings and investments; neither |
| `internal` | a card bill or a move between your own accounts; counted once, on the card rows |
| `excluded` | the user (or a rule) said not to count it |
| `gone` | a pending row the bank stopped reporting |
| `trashed` | in Trash; counts nowhere until restored |

The rule exists twice: `flowOf()` in TypeScript and `LEDGER_SQL` as a SQL
view of every row with its flow and review flags. A test proves they agree.
Every query reads rows through `LEDGER_SQL`, so no screen or query
re-derives what counts. Totals (summaries, trend, curves, money flow, day
subtotals, "left") are computed in core; the window only renders them.

## Migrations

Numbered SQL files in `src/core/db/migrations/`, run in order on open and
recorded in `schema_migrations`. **A shipped migration is never edited**:
change the schema with a new, higher-numbered file. Only one spec per wave
adds a migration, so numbers land in order.

## Profiles, the Demo profile and screenshots

Each profile is its own database file (`src/main/profiles.ts`). The Demo
profile is the real app on made-up data: `src/core/demo` seeds it through
the same `ingest()`, rules and categories code a real sync uses. It never
syncs.

Dev runs keep their data in a separate `CoinLeak-dev` folder;
`COINLEAK_DATA_DIR` overrides it. A screenshot run
(`COINLEAK_SCREENSHOT=path.png npm run shot`, see `AGENTS.md`) always gets
a fresh temp folder holding only a seeded Demo profile, so it never opens
a real database. `?shot=...` in `COINLEAK_START_ROUTE` asks a page to open
a dialog or a state for the picture.

## Security in one paragraph

The window is sandboxed with context isolation and no Node. It loads only
`app://coinleak/` files with a strict CSP (`src/main/protocol.ts`), cannot
navigate away or open windows, and every permission and remote request is
refused (`src/main/security.ts`, decisions in `policy.ts`). Only the sync
browser talks to the internet, and only to the bank's own domains. The app
never sees a bank password: the user types it into the bank's page.
