#!/usr/bin/env bash
# Builds a repository whose changesets delete files and folders, to restore them from a diff: a file, a folder with
# files and a subfolder in it, a name with spaces and accents, a file whose path a new file took afterwards, and 25
# files deleted one by one (more than are restored without asking).
# Usage: scripts/sandboxes/deletes.sh [repo-name [workspace-folder]]   → repo undelete-demo@local, workspace /tmp/uvcs-undelete
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the
# workspace always a folder of /tmp. A `cm undelete` typed by hand there takes /private/tmp/…, as cm names it on macOS:
# given /tmp/… it writes the files, then fails ("Item path not in workspace").
set -euo pipefail
NAME=${1:-undelete-demo}
FOLDER=${2:-uvcs-undelete}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }

cd "$WK"
for f in Game Player Enemy Pickup; do w "src/$f.cs" "public class $f {}"; done
w docs/guide.md "# Guide"
w docs/controls.md "Arrows to move."
w docs/images/logo.svg '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
w "notes/Café menú.txt" "Coffee and cake."
w README.md "# Undelete demo"
mkdir -p levels
for i in $(seq -w 1 25); do printf 'level %s\n' "$i" > "levels/Level$i.txt"; done
commit "Initial project"

cm rm src/Enemy.cs >/dev/null
cm rm docs >/dev/null
cm rm "notes/Café menú.txt" >/dev/null
commit "Drop the enemy, the docs and the menu"

cm rm src/Pickup.cs >/dev/null
commit "Drop the pickup"
w src/Pickup.cs "public class Pickup { int points; }"
commit "A new pickup where the old one was"
# Each file deleted on its own, the folder kept: 25 items to restore at once.
for f in levels/Level*.txt; do cm rm "$f" >/dev/null; done
commit "Drop every level"
echo "Built $REPO in $WK: cs:2 deletes a file, a folder and a name with accents; cs:3 deletes src/Pickup.cs, which cs:4 adds anew; cs:5 deletes 25 levels"
