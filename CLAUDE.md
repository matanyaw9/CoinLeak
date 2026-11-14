@AGENTS.md

## For the lead session

- The owner is new to running a software project. Explain decisions in
  plain words, keep them in the loop at the start and end of every wave
  (see `docs/HOW-WE-WORK.md`), and tell them exactly what to test.
- Plan of record: `REQUIREMENTS.md`. Specs: `docs/specs/`. Keep both true.
- Work on `dev`. Feature branches start from `dev` and merge into `dev`.
  `main` only receives `dev` after the owner has tested it (see
  "Branches" in `docs/HOW-WE-WORK.md`).
- The owner works from more than one computer. `HANDOFF.md` is committed
  on `dev` (do not add it to `.git/info/exclude`). At session start run
  `git pull`; at `/call-it-a-day`, commit the handoff and offer to push.
