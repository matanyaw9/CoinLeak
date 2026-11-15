# Handoff: CoinLeak
_Last session: 2026-11-16 · branch: dev · last commit: 6d09775 docs: one checklist for the first public release_

## Today in one line
Getting ready to ship to the brother: the Windows 11 VM test passed, and the public security docs are written. Both are on branches, waiting for the owner's OK to merge.

## What we did
- Mapped out shipping, updates and risks for real users. The plan of record is `docs/PUBLISH-CHECKLIST.md`.
  - Ship through GitHub Releases, unsigned, as version 0.1.0, tagged on `main`, with a SHA-256 file next to the installer.
  - Updates stay manual: a new installer goes over the old one. F28 step 1 is the "Check for updates" button that opens the Releases page.
  - The owner already has 2FA on GitHub.
- First run of agents in herdr panes (owner wanted to see agents run agents). Two Claude agents:
  - `security`, branch `docs/security-statements` (5 commits, docs only, worktree `.claude/worktrees/security-statements`):
    - README Privacy section and Disclaimer
    - `SECURITY.md`
    - `.github/ISSUE_TEMPLATE/` (bug report, feature request, config)
    - `THIRD-PARTY-NOTICES.md`
    - Checklist section 5 ticked
    - The lead reviewed the diff and checked its claims against the code: no em dashes, password-manager prefs off, reCAPTCHA allowlist, Danger zone.
  - `vmtest`, branch `test/windows-vm` (1 commit 30cda3b, worktree `/home/matanya/Projects/CoinLeak-winvm`):
    - VM test results are in `docs/OWNER-TESTS.md` section 7. All passed except two:
    - SmartScreen did not show (inconclusive): the download came from the private address `10.0.2.2`.
    - The second-user test was skipped.
- Windows 11 VM: quickemu, config `~/VMs/windows-11.conf`, disk in `~/VMs/windows-11/`.
  - Discs are symlinks to `~/Downloads`.
  - It was installed unattended, as local user Quickemu, password quickemu.
  - Inside Windows, the host is at `http://10.0.2.2:<port>/` (QEMU user networking, bind the server to 127.0.0.1).

## Where we stopped
- `dev` is clean apart from this file. Nothing from today is merged.
- The VM was still running at wrap-up. Check that a `clean` snapshot exists: `quickemu --vm ~/VMs/windows-11.conf --snapshot info`.
- The `vmtest` and `security` Claude agents are idle in herdr panes w1:pE and w1:pF. All their work is committed, so the panes are safe to close.
- Ports 8080, 8091 and 8100 on localhost were in use. They are not from this session.

## Dead ends / don't retry
- **Do not build release installers in a worktree with a symlinked `node_modules`** (the AGENTS.md worker tip). The `app.asar` misses about 5,000 files. Build releases from the main checkout. Add this to `docs/RELEASE.md` and AGENTS.md.
- **Do not test SmartScreen with a download from `10.0.2.2` or a local server.** Windows treats it as a local network file. Use a draft GitHub Release.
- A Wine Mono popup still appeared once during `npm run dist:win` despite the overrides in `scripts/dist-win.sh`. Cancel is safe. `dist:win` also failed once with "wine process failed" and passed on retry.
- quickemu has no libvirt and no `virsh`. Don't look for a VM bridge.
- `herdr agent prompt --timeout` needs `--wait`. You can't read a working agent's scrollback; use `--source visible`, or ask it for a short status.

## Open questions / decisions for the user
- Read the security docs, then say "merge": `git diff dev...docs/security-statements -- README.md SECURITY.md`.
- Merge `test/windows-vm` (results only)?
- GitHub settings, by hand:
  - private vulnerability reporting (needed before the new docs are public)
  - Dependabot alerts and security updates
  - secret scanning with push protection
  - protect `main`
  - Discussions: owner's call
- Ship to the brother before the F28, F56 and F57 checklist items? Recommended: yes, as a 0.1.0 pre-release, since the VM test passed.

## Next steps
1. After the owner's OK, merge `docs/security-statements` and `test/windows-vm` into `dev`. Then add the symlink-build warning to `docs/RELEASE.md`.
2. Fix the bug found in the VM: on a fresh profile with no transactions, Transactions shows "Nothing here yet" and hides "Add cash".
3. Release 0.1.0:
   - bump the version
   - `npm run check`
   - merge `dev` into `main`
   - tag `v0.1.0`
   - build in the main checkout with `npm run dist:win`
   - draft a GitHub Release with the `.exe` and a SHA-256 file, marked pre-release
4. Retest SmartScreen in the VM: restore the `clean` snapshot, then download from the draft Release in Edge.
5. Publish, then send the brother the `releases/latest` link with the "Keep", "More info", "Run anyway" steps.
6. Later, before strangers:
   - F28 step 1 (version and "Check for updates")
   - F56 backup, plus a database copy before migrations
   - F57 experimental bank labels
   - F27 feedback buttons
   - "Delete everything" leaves the theme setting behind

## History
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
- 2026-11-09 (evening): waves 8 and 9 (specs 20 to 24) merged; F61 chart controls requested.
- 2026-11-09 (later): F45 decided; specs 16, 17, 18, 19 merged; profiles replace the demo; owner test lists written.
- 2026-11-09: wave 5 merged; skipped-migration fix; wave 6 specs 16 to 18 started (17 done); code review saved.
- 2026-11-08: Cal verified; feature list; waves 4 and spec 14 merged; specs 13 and 15 in flight.
