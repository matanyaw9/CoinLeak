# Security

CoinLeak handles people's bank data, so we take security problems
seriously. Thank you for helping keep it safe.

## How to report a problem privately

Please do not open a public issue for a security problem. Use GitHub's
private reporting instead:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Describe the problem and how to make it happen.

Only the maintainers can see the report. We will reply there and work on a
fix with you before anything is made public.

CoinLeak is a small volunteer project, so a reply can take some days.
There is no bug bounty.

## Never include real data

Do not put any of these in a report, an issue, or a screenshot:

- passwords, one-time codes, or anything you type to log in to a bank
- real transactions, amounts, balances, or account or card numbers
- your CoinLeak database file or anything from `%APPDATA%\CoinLeak`

Use made-up data instead. CoinLeak has a Demo profile with made-up data for
exactly this. If a problem only shows up with your real data, describe it
in words and we will ask for what we need.

## What is in scope

The rules CoinLeak promises to keep (from `REQUIREMENTS.md`, section 3):

- **Bank passwords.** CoinLeak must never ask for, see on purpose, store,
  or log a bank password. Any way to make it do so is a security problem.
- **Data leaving the computer.** The CoinLeak window must not reach the
  network. The sync browser may only reach the bank's own websites (plus
  Google's "I'm not a robot" check for the few banks whose login needs it).
  Any way around this is a security problem.
- **The sync browser.** It must start with a fresh profile, be reachable
  only by CoinLeak (no debugging port), and be closed and deleted after
  each sync.
- **The app window.** Sandbox, isolation, content security policy, no
  navigation away, no new windows, no permissions. Any way for a web page
  or another program to run code in CoinLeak or call into it.
- **Logs and errors.** Transaction text, amounts, account numbers, or a
  bank's or library's error text showing up in logs or error messages.
- **The data on disk.** CoinLeak writing data outside its data folder, or
  leaving data behind after "Delete everything".
- **The installer and the packaged app**, including the dependencies it
  ships.

## Not in scope

- Malware already running on your computer as you. It can read your files
  and your keyboard, with or without CoinLeak, the same as with normal
  online banking.
- Someone with your unlocked computer. Use a screen lock and disk
  encryption (BitLocker on Windows).
- Problems in a bank's own website. Report those to the bank.
- Problems in israeli-bank-scrapers itself. Report those to
  [that project](https://github.com/eshaham/israeli-bank-scrapers); tell us
  too if CoinLeak is affected.
- Windows warning that the installer is from an unknown publisher. The
  installer is not code-signed yet; `README.md` explains this.

## Supported versions

Only the newest release gets security fixes.
