# Third-party notices

CoinLeak contains code adapted from the projects below, and uses
israeli-bank-scrapers as a package. Each one's license asks that its
notice travels with the code, so here they are.

## Spent

<https://github.com/Shaya16/Spent> by Shaya16. Spent's README says it is
released under the MIT License. Its repository has no LICENSE file and no
copyright line, so the notice below names the project and its author.

Files in CoinLeak that copy or adapt Spent code say so in their first
lines (for example `src/core/ledger/card-patterns.ts`,
`src/core/ledger/dedup.ts`, `src/renderer/src/styles/globals.css` and
several components under `src/renderer/src/components/`).

```
MIT License

Copyright (c) Shaya16 (Spent, https://github.com/Shaya16/Spent)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## israeli-bank-scrapers

<https://github.com/eshaham/israeli-bank-scrapers>, used as an npm package
(version pinned in `package.json`). Its own LICENSE file is installed with
it, inside the app. `src/main/sync/self-login.ts` also repeats a few of
its login page addresses, with a comment naming where each came from.

```
MIT License

Copyright (c) 2017 Elad Shaham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Other packages CoinLeak depends on carry their own license files inside
the installed app.
