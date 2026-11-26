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

# A checksum beside the installer, so anyone can check the file was not swapped.
sha256sum release/CoinLeak-Setup-*.exe | sed 's|release/||' > release/SHA256SUMS.txt
cat release/SHA256SUMS.txt
