# Code review: wave 15 round 3 and wave 16, 2026-11-27

**Reviewed:** `git diff 4841035..5821cfb`, 24 commits, 50 files, +1646 / -216:
- spec 41 A: newer rules win, with hints about the rules they contradict (F92)
- spec 41 B: restore lets you choose what to keep (F93)
- spec 42 A: About CoinLeak in Settings
- spec 42 B: the fixes from the round 2 review
- the lead's own commits: `app:openLink`, trimming a restored copy before it becomes a profile, README, RELEASE.md, and `SHA256SUMS.txt` in `scripts/dist-win.sh`

No code was changed.
**Checks:** `npm run check` is green: typecheck, lint, 1332 tests in 110 files, build.
**Verdict:** Good to merge into `main` once the owner has tested it. The three places you asked about hold up:
- **The link out to the web** accepts only a name, never an address.
- **Restore** leaves no removed row in the file or beside it, and never writes to the open profile.
- **The new rule order** is a small change in one place, with the starter lists and Undo kept where they belong.

One small gap in restore is worth fixing before a friend uses it (Should fix 1).

### Should fix

1. `src/core/db/restore.ts:44` (`dropTransactions`): **the list of banks the user added stays in the file when Transactions is left out.** The `addedProviders` setting (`shared/types.ts:527`) lists the banks and cards the user added. `dropTransactions` deletes the accounts but not this setting. Example: someone restores only Rules and Budgets on a friend's computer. Their banks still show on Finance accounts, and the new file still records which banks they use, although the dialog said Transactions come "with their accounts". Accounts that a kept rule still points at stay anyway (spec 41 B), and they show without this setting. Fix: add `DELETE FROM settings WHERE key = 'addedProviders';` to `dropTransactions`, and a check for it in the `it.each(CHOICES)` test in `restore.test.ts`. `syncFrom` is a preference, not personal data, so it can stay.

### Nice to have

1. `scripts/dist-win.sh:18`: the glob `release/CoinLeak-Setup-*.exe` also picks up installers from earlier versions still in `release/`. `SHA256SUMS.txt` then has one line per old version, and step 7 of `RELEASE.md` uploads that file next to a single installer. Fix: build the name from the version (`CoinLeak-Setup-$(node -p "require('./package.json').version").exe`), or empty `release/` before building. The comment ("so anyone can check the file was not swapped") also claims too much. A checksum on the same release page shows the download is complete and unchanged on the way. It does not protect against a swapped release, because whoever could swap the installer could swap the checksum too. Say "was not damaged or changed on the way".
2. `src/renderer/src/components/settings/backup-section.tsx:149`: the comment says "Enter continues", but focus starts on the first tick box, and Enter there does nothing (Space ticks; only Enter on Continue continues). Either handle Enter on `DialogContent` when at least one part is ticked (the spec's keyboard line lists Enter), or change the comment to match.
3. `docs/PUBLISH-CHECKLIST.md:25`: F56 still says "not built", although spec 39 built it. F28 step 1 and F27 are built now (spec 42 A) but still unticked. Tick each one after the owner tests it, and drop "not built" now.
4. Three new screenshot hooks sit in product code, the pattern already tracked in `docs/BACKLOG.md:21`: `rules/order-shot.ts` (it writes: it saves two rules and ignores two rows), `?shot=about` in `settings/about-section.tsx:38`, and `backup-choose` in `backup-section.tsx:81`. Add them to that backlog line. The order shot is the first one that writes rules, so it is the one most worth moving into `demo-shot.ts`.

### Checked and fine

- **`src/main/links.ts`.**
  - It is the only `shell.openExternal` in `src/main`.
  - It takes a name, checks it with `Object.hasOwn` against a fixed record, and opens a constant address. A wrong type, a full address, `__proto__` or `toString` all get `BAD_REQUEST` before anything opens. The test covers each of those, and also checks that every address is `https://github.com`.
  - The feedback address has no query string, so nothing about the user goes along.
- **Restore keeps the open profile safe.**
  - `checkKeep` refuses anything but three yes-or-no answers with at least one yes, before the sync check or any dialog.
  - Trimming opens its own connection on the private copy, before the copy becomes a profile (`main/backup.ts:128`). If anything fails there, the copy is deleted and the error code is fixed. A failed open puts the old profile back first and then deletes the new one.
  - The main tests cover the choice, a refused choice, and a trim that fails.
- **Restore leaves no removed rows behind.**
  - Everything is removed in one transaction. Rules go first, so `rule_conditions` no longer protects accounts when Rules is left out. Then `VACUUM` and a `wal_checkpoint(TRUNCATE)`.
  - The test reads the bytes of the file and its `-wal` file for every removed description, memo and note. It runs all seven choices against the Demo database, with `foreign_key_check` and the cash wallet checked.
  - With Rules left out, the rows rules had sorted or ignored become the user's, and running the rules afterwards changes nothing (tested).
- **F92, the rule order.**
  - `insertRuleOnTop` shifts every rule down one and inserts at 1. `renumber` always writes 1 to n and `nextPosition` starts at 1, so position 1 is always first. There is no unique index on `position` to break the shift.
  - The editor and new known places go on top. Starter lists still go last (`appendPlaces(..., "bottom")`). `createRule` still adds last for Undo and the Demo.
  - Contradictions compare each action on its own, and `setExcluded` is the same 0/1 on both sides.
  - The editor previews a new rule with no higher rules, as spec 41 A item 2 asks. "Set by you" rows have no tick box and are not counted.
- **Spec 42 B.** Each item from the round 2 review is done as written: a pure `partlyTicked` with its test, the `onDragStart` target check, focus lighting the summed line, names read from the query cache, and arrow keys held on the raise offer.

### Not repeated here

Already in `docs/BACKLOG.md`:
- The earlier screenshot hooks.
- The missing "only this level" filter. The chooser now says when a parent's own rows are left out.
- Tab out of the Transactions and Trash lists.
