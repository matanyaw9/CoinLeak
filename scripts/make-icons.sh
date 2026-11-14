#!/usr/bin/env bash
# Renders build/icon.svg into the PNG app icons (16 to 512 px) and the Windows
# icon.ico with ImageMagick.
# Run again only when the logo changes; the PNGs are checked in.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p build/icons
for size in 16 24 32 48 64 128 256 512; do
  magick -background none -density 384 build/icon.svg -resize "${size}x${size}" "build/icons/${size}x${size}.png"
done
cp build/icons/512x512.png build/icon.png
# Windows icon (installer, exe, shortcuts): one .ico holding 16 to 256 px.
magick build/icons/{16x16,24x24,32x32,48x48,64x64,128x128,256x256}.png build/icon.ico
echo "Wrote build/icon.png, build/icon.ico and build/icons/*.png"
