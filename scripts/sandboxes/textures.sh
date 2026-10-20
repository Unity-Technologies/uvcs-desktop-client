#!/usr/bin/env bash
# Builds a small Unity project whose textures come in the formats the browser can't decode, for the image diff: a
# changeset that repaints a TGA, a TIFF normal map, an EXR and an HDR sky (a sun brighter than white), an 8-bit PSD
# with alpha and a 16-bit grayscale one, widens a TGA banner, adds a TGA and deletes a TIFF, and leaves two Photoshop
# files the viewer can't read (one saved without "Maximize Compatibility", one in CMYK); and a branch, /main/retouch,
# that conflicts with it on the TGA and the PSD with alpha (the merge page's version cards). The files are written by
# textures/writeTextures.ts.
# Usage: scripts/sandboxes/textures.sh [repo-name [workspace-folder]]   (from the repository root)
#        → repo textures@local, workspace /tmp/uvcs-textures
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the
# workspace always a folder of /tmp.
set -euo pipefail
NAME=${1:-textures}
FOLDER=${2:-uvcs-textures}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | -* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"
GENERATOR=$(mktemp -d)/writeTextures.mjs

npx esbuild scripts/sandboxes/textures/writeTextures.ts --bundle --platform=node --format=esm --outfile="$GENERATOR" --log-level=warning

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null
cd "$WK"

# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
step() {
  sleep 1
  node "$GENERATOR" "$1" "$WK"
  cm ci --all --private -c "$2" >/dev/null
}

step initial "Imported the first textures: the crate, the rock, the skies, the hero and the UI"
cm br create /main/retouch -c "Retouch of the crate and the hero" >/dev/null
cm switch /main/retouch --noinput >/dev/null
step retouch "Darkened the crate and gave the hero red hair"
cm switch /main --noinput >/dev/null
step repaint "Repainted the textures: a stencil on the crate, more bumps, a brighter sun, blond hair, a wider banner"

echo "Workspace: $WK (repository $REPO). Merge /main/retouch into /main for the version cards."
