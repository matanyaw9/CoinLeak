#!/usr/bin/env bash
# Builds the Windows installer from Linux into release/. electron-builder runs
# one NSIS step under wine, so give wine its own folder, created once with the
# Mono and Gecko install prompts turned off: it never touches ~/.wine.
set -euo pipefail
cd "$(dirname "$0")/.."

export WINEPREFIX="${COINLEAK_WINEPREFIX:-$HOME/.cache/coinleak-wine}"
if [ ! -d "$WINEPREFIX" ]; then
  WINEDLLOVERRIDES="mscoree,mshtml=" WINEDEBUG=-all wineboot --init
  wineserver --wait
fi

npm run build
npx electron-builder --win --publish never

# A checksum for this version's installer only (older ones may still sit in
# release/). It shows a download arrived complete and unchanged on the way;
# it cannot prove the release itself was not swapped.
installer="CoinLeak-Setup-$(node -p "require('./package.json').version").exe"
sha256sum "release/$installer" | sed 's|release/||' > release/SHA256SUMS.txt
cat release/SHA256SUMS.txt
