# CoinLeak 0.1.0 (draft release notes)

Draft for the first GitHub pre-release. The owner edits and approves
these before the tag; paste them into the release page.

---

**CoinLeak 0.1.0: first test version for Windows**

CoinLeak shows where your money goes, from your Israeli bank and credit
card accounts, and keeps everything on your computer. No cloud, no
account to sign up for, no AI, and it never asks for or keeps your bank
password: you log in on the bank's own page.

### Install

1. Download `CoinLeak-Setup-0.1.0.exe` below.
2. Windows says "Windows protected your PC" because the installer is not
   code-signed. Click "More info", then "Run anyway".
3. It installs for your Windows user only and opens. Press Sync and log in
   to your bank.

Optional: check the download in PowerShell with
`Get-FileHash .\CoinLeak-Setup-0.1.0.exe` and compare it with
`SHA256SUMS.txt`.

### What it does

- **Sync** your bank and cards: you log in on the bank's page, CoinLeak
  downloads the transactions and closes the browser.
- **Home:** what is left this month and per day, where the money went,
  spending month by month, saved or overspent, and budgets.
- **Transactions:** search, sort, notes, ignore, trash with restore, cash
  you spend by hand, card bills matched so nothing is counted twice.
- **Categories** up to three levels, with monthly budgets right there.
- **Rules** sort each shop once; a newer rule wins, and the editor shows
  what it changes before you save.
- **Backup and restore** to one file, choosing what to bring over, and a
  CSV for Excel.
- Works from the keyboard; press `?` for the list.

### Banks

Tested with real accounts: **Discount Bank** and **Cal**. The others are
marked "Experimental": they work against test pages, but nobody has
confirmed them with a real account yet. If yours works (or not), Settings,
"Report a bug or an idea" opens a GitHub issue. Nothing is sent from the
app.

### Updates

Settings, About, "Check for updates" opens this Releases page. Download
the newer installer and run it over the old one; your data stays. CoinLeak
never downloads or installs anything by itself.

### Your data

It lives in `%APPDATA%\CoinLeak\data`. Uninstalling keeps it; Settings,
"Delete everything" removes it. Make a backup now and then: Settings,
Backup and export.

This is a test version: expect rough edges, and please tell us about them.
