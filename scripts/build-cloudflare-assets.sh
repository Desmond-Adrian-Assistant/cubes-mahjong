#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/cloudflare/public"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT/index-3d.html" "$OUT/index.html"
cp -R "$ROOT/assets" "$OUT/assets"
cp -R "$ROOT/css" "$OUT/css"
cp -R "$ROOT/js" "$OUT/js"
# Keep generated/test artifacts out of the static deploy.
rm -rf "$OUT/assets/generated"
find "$OUT" -name '.DS_Store' -delete
