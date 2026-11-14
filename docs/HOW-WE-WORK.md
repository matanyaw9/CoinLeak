# How we work on CoinLeak

A guide for the owner (you) on running an AI-built project. The short
version: **you decide and test, the lead plans and reviews, agents build.**

## Roles

| Who | Does | Does not |
|-----|------|----------|
| **You (owner)** | Decide what the app should do and what "good" looks like. Test with your real bank. Say what feels wrong. Approve each wave before the next starts. | Read every line of code. |
| **Lead (Claude in your main session)** | Keeps `REQUIREMENTS.md` true. Writes one spec per piece of work. Starts agents. Reviews their work against the spec and the security rules, runs all checks, looks at screenshots, merges. Reports to you in plain words. | Build big features itself while agents are running. |
| **Agents (subagents)** | Each gets one spec and its own copy of the repo (a git worktree). Builds it, writes the tests, runs the checks, reports. | Touch files outside their spec, change the rules, or see your real data. |

## The loop, once per wave

1. **Plan.** The lead proposes the next wave: 1 to 3 specs that can run in
   parallel because they own different files. You read the summary and
   say go, or change it.
2. **Build.** Agents work in parallel in separate worktrees on branches
   named `wave1/sync`, `wave1/ledger`, and so on. This takes a while; you
   do not need to watch.
3. **Review.** For each agent, the lead:
   - runs `npm run check` (types, lint, tests, build) on its branch,
   - reads the diff against the spec and `AGENTS.md`,
   - looks at screenshots for UI work,
   - sends it back with concrete fixes if anything is off.
4. **Merge.** Clean branches go into `dev`, one at a time, with checks
   rerun after each merge.
5. **You test.** The lead tells you exactly what to try (for example
   "run `npm run sync:try -- discount` and log in"). You report what you
   saw. This is the step only you can do and the most important one.
6. **Release.** When your tests pass, the lead merges `dev` into `main`.
7. **Decide.** Update `REQUIREMENTS.md` if anything changed, then plan the
   next wave.

## Branches

| Branch | What it holds |
|--------|---------------|
| `main` | Work you have tested. Only `dev` merges into it. |
| `dev` | Day-to-day work. Every feature branch starts here and merges back here. `HANDOFF.md` lives here. |
| `wave9/...`, `fix/...` | One piece of work, branched from `dev`. Deleted after merging. |

## Working from more than one computer

GitHub is the meeting point. The rule: **pull when you sit down, push when
you get up.**

- **Start of a session:** `git switch dev && git pull`, then
  `/back-to-business`.
- **End of a session:** `/call-it-a-day` writes `HANDOFF.md`; commit it
  on `dev` and push `dev` (and `main` if it moved).
- **First time on a new computer:** clone the repo, `git switch dev`, then
  follow "Run it" in `README.md`. The `/call-it-a-day` and
  `/back-to-business` skills live in your user folder
  (`~/.claude/skills/`), not in the repo; copy them over too.
- **What does not travel:** your app data (`CoinLeak` and `CoinLeak-dev`
  folders) stays on each computer. That is on purpose: real data never
  goes to GitHub. Each computer syncs its own bank data.

## What "reviewing" means for you

You do not review code. You review **behavior** and **feel**:

- Does it do what I asked? Is anything missing or surprising?
- Is it beautiful and comfortable? Screenshots and running the app.
- Do the numbers match my bank? Check one month by hand against the bank
  site once; after that, spot checks.
- Did anything ask me for my bank password outside the bank's own page?
  That is a stop-everything bug.

## Words you will see

- **Repository (repo)**: the project folder with its full history (git).
- **Commit**: one saved change with a message, like `feat: add month picker`.
- **Branch**: a separate line of work. `main` holds tested work, `dev`
  the work in progress.
- **Worktree**: a second folder checked out from the same repo on another
  branch, so agents can work in parallel without touching each other.
- **Merge**: bringing a branch's commits into another, usually `dev`.
- **Spec**: a short document that tells one agent exactly what to build,
  which files it owns, and which tests prove it is done.
- **Migration**: a numbered SQL file that changes the database layout.
  Old ones are never edited, so your existing data upgrades safely.
- **CI**: checks that run automatically on every push to GitHub.

## Your real data

- Real syncs only happen when you run them. Agents never log in to your
  bank and never see the database file.
- Development runs use a separate data folder (`~/.config/CoinLeak-dev`).
  Your real data will live in `~/.config/CoinLeak` once you use a packaged
  build.
- Never paste real transactions into the chat. If something looks wrong,
  describe it ("the Cal bill for October is counted twice") or share a
  screenshot with amounts blurred.

## Keeping cost and chaos down

- Small waves. Three parallel agents at most. Each spec fits on two pages.
- Specs before code. A vague request makes an agent guess, and guessing
  is what costs tokens and creates bugs.
- One owner per file. Two agents editing the same file means conflicts.
- Tests are the contract. If something matters (no double counting, no
  password in logs), there is a test with its name on it.
- When an agent is stuck or going in circles, stop it and rewrite the spec
  rather than letting it keep trying.
- Parallel agents spend your plan's usage limit faster. When the limit
  hits, every running agent stops at once. Their work is kept: the lead
  resumes each one where it stopped after the limit resets, and restarts
  any that had not changed anything yet. If you are near the limit, run
  one agent at a time.

## Commands you might run

```
npm ci && npm run setup     # first time after cloning
npm run dev                 # run the app with live reload
npm run check               # everything the lead runs before merging
```

## When to change the plan

Changing direction is fine and cheap before code exists and expensive
after. Raise doubts at the "Plan" step. If you change your mind later,
say so and the lead will update `REQUIREMENTS.md` first, then the code.
