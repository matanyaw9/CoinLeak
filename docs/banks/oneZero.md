# One Zero (`oneZero`)

Status: **unsupported**. CoinLeak does not sync One Zero, and the app
says why under "Why isn't my bank here?".

## Classification

`unsupported`. `OneZeroScraper` extends the plain `BaseScraper`, with no
browser at all (`lib/scrapers/one-zero.js` L20). Its `login()` (L105-137)
posts your email and password from Node to
`https://identity.tfd-bank.com/v1/getIdToken` and `/sessions/token`
(L111-126), after an SMS one-time-code flow the library drives itself
(`triggerTwoFactorAuth` and `getLongTermTwoFactorToken`, L21-69; the code
is asked for through an `otpCodeRetriever` callback, L80-96). The download
then calls a GraphQL API from Node (`mobile.tfd-bank.com`, L19, L150, L232).

## Why not

There is no bank login page to show you. Supporting One Zero would mean
CoinLeak itself asking for your password and sending it, which breaks
CoinLeak's first rule (REQUIREMENTS.md D7): CoinLeak never asks for,
sees, stores or forwards a bank password.

Hosts the library would contact from Node (never from CoinLeak):
`identity.tfd-bank.com`, `mobile.tfd-bank.com`.

## What would change it

A One Zero website login that leaves a session in the browser, and a
library download that uses that session. Until then it stays unsupported.
