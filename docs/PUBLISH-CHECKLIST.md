# Before we publish CoinLeak

One list of everything to do before we tell people "download CoinLeak".
Tick items as they are done. Details live in the linked docs; this file
only collects them.

Status on 2026-11-15: the GitHub repo `matanyaw9/CoinLeak` is already
**public** (created 2026-11-07), with `main` and `dev` pushed. So "publish"
here means: the first release people are invited to install, not the
first time the code is visible.

## 1. Nothing private is in the repo (the secrets scan)

Handled in its own session ("Project secrets scan before GitHub publish").
Because the repo is already public, anything it finds is already out:

- [ ] Scan the full git history, all branches, not only the current files.
- [ ] If a real secret or real transaction turns up: treat it as leaked.
      Change the password or key first, then clean the history.
- [ ] Re-scan right before tagging the first release.

## 2. The app is finished enough for strangers

From `docs/FEATURES.md`, wave 10 ("the first public version"):

- [ ] F56 Export a copy of my data (backup). Promised in
      `REQUIREMENTS.md` section 6, not built.
- [ ] F57 Banks not tested live are labeled "experimental" in the app.
      Only Discount and Cal are verified.
- [ ] F28 step 1: Settings shows the version and a "Check for updates"
      button that opens the GitHub Releases page. No auto-updater.
- [ ] F27 "Report a bug" and "Star us on GitHub" buttons (open GitHub in
      the normal browser; nothing is sent from the app).
- [ ] Specs 27 (budgets) and 28 (categories and fixes) merged, tested by
      the owner, and in the installer.
- [ ] Owner decides: anything else in `docs/BACKLOG.md` that must be
      fixed before strangers use it.

## 3. Windows 11 test in a virtual machine

We build the `.exe` on Linux and have never run it on Windows (F55). A
virtual machine (VM) is a pretend computer inside this one, so we can try
a clean Windows 11 without a second PC.

### Set up the VM (once)

1. Install a VM program on Linux. Recommended: `virt-manager` (QEMU/KVM),
   plus `swtpm` and `edk2-ovmf`. Windows 11 refuses to install without a
   TPM 2.0 chip and Secure Boot; those two packages fake them.
   VirtualBox 7 also works and is easier to click through.
2. Download the Windows 11 ISO from Microsoft's own download page.
3. Create the VM: 4 GB RAM or more, 64 GB disk, 2+ CPUs, TPM 2.0 on,
   UEFI with Secure Boot on.
4. Install Windows. It runs unactivated (a small watermark) which is
   fine for testing. Use a local account.
5. Update Windows and Edge, then take a **snapshot** named "clean".
   Every test run starts from that snapshot, so we always test what a new
   user has.

### Get the installer in the way a user would

SmartScreen ("Windows protected your PC") only shows for files that came
from the internet. Copying the `.exe` through a shared folder skips it,
so the test would lie. Instead:

- [ ] Download it in Edge inside the VM, from a draft GitHub Release or
      from a small web server on the Linux machine.

### Test run (write results into `docs/OWNER-TESTS.md`)

- [ ] SmartScreen shows, "More info" then "Run anyway" works, as
      `docs/RELEASE.md` describes.
- [ ] Installs with no admin prompt; Start menu and desktop shortcuts
      appear with the CoinLeak icon.
- [ ] The app opens; the window and taskbar icon are right.
- [ ] Hebrew text and right-to-left layout look correct; fonts are local.
- [ ] Data folder is created at `%APPDATA%\CoinLeak\data`.
- [ ] Sync finds Edge on its own (no Chrome installed) and the bank's
      login page opens. Owner's call whether to log in to a real bank in
      the VM; the brother's real PC is the real test.
- [ ] Close and reopen: data is still there.
- [ ] Install the next version over the old one: data is kept.
- [ ] Uninstall from Settings, Apps: the app is gone, the data folder
      stays (as documented).
- [ ] Delete everything (F52) inside the app really empties the folder.
- [ ] Optional: a second Windows user on the same VM sees no data from
      the first.

After the VM: the brother installs it on his real PC and syncs with Edge
(already planned in `HANDOFF.md`).

## 4. How we ship it

Decisions for the owner, with a recommendation each:

- [ ] **Where people download it.** Recommended: GitHub Releases on
      `matanyaw9/CoinLeak`. Free, and F28's "Check for updates" points
      there.
- [ ] **Version number.** Today `0.0.1`. Recommended: `0.1.0` for the
      first public release, a git tag `v0.1.0` on `main`, and release
      notes in plain words. Releases come from tags, not every push (F28).
- [ ] **Code signing.** Without a certificate Windows says "unknown
      publisher" and SmartScreen warns. Options: stay unsigned and explain
      it (free, current plan); or buy a certificate later (costs money
      every year). Recommended: unsigned for the first release.
- [ ] **Checksums.** Publish the installer's SHA-256 next to it, so
      anyone can check the file was not swapped.
- [ ] **Where it is built.** Today on the owner's Linux PC
      (`npm run dist:win`). Optional later: a manual GitHub Actions job,
      so the build does not depend on one machine.
- [ ] **Linux package** (F55 "Linux later"): AppImage or rpm. Decide if
      it is in the first release or the next.
- [ ] **macOS:** not tested (D4). Say so in the README.

## 5. The public repo page

- [ ] README for users first: what CoinLeak is, a screenshot (demo data
      only), "Install on Windows", supported banks and which are
      experimental. Developer notes lower down.
- [x] Privacy in plain words: no bank passwords stored, nothing leaves the
      computer except the browser talking to the bank, where the data
      lives, how to delete it.
- [x] "Not financial advice; not made by or for any bank" disclaimer.
- [x] LICENSE: MIT, already there. Check the credits to Spent and
      israeli-bank-scrapers match their licenses.
- [x] `SECURITY.md`: how to report a security problem privately.
- [x] Issue templates (bug report, feature request) that remind people
      not to paste real transactions.
- [ ] GitHub settings: protect `main`, turn on Dependabot alerts and
      secret scanning, decide whether Discussions is on.

## 6. Final checks on release day

- [ ] `npm run check` green on `main`.
- [ ] Fuses and package contents checked as in `docs/RELEASE.md`.
- [ ] Windows VM test from section 3 passed on this exact installer.
- [ ] Secrets re-scan clean.
- [ ] Tag, upload installer and checksum, publish the release.
