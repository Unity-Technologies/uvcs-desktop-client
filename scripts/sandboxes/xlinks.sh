#!/usr/bin/env bash
# Builds a workspace with xlinks to edit: a writable one with branch expansion rules (one with a hyphen in its branch
# names), a read-only one showing a folder of its repository, and branches and a label to point them to.
# Usage: scripts/sandboxes/xlinks.sh [repo-name [workspace-folder]]   → repos xlinks-demo@local and xlinks-demo-lib@local,
# workspace /tmp/uvcs-xlinks
# It deletes and recreates them, so it takes only names: the repositories are always on the local server, the
# workspaces always folders of /tmp.
set -euo pipefail
NAME=${1:-xlinks-demo}
FOLDER=${2:-uvcs-xlinks}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
LIB="$NAME-lib@local"
WK="/tmp/$FOLDER"
LIB_WK="$WK-lib"

for repo in "$REPO" "$LIB"; do cm rmrep "$repo" >/dev/null 2>&1 || true; done
for wk in "$WK" "$LIB_WK"; do cm wk delete "$wk" >/dev/null 2>&1 || true; rm -rf "$wk"; done
cm mkrep "$REPO" >/dev/null
cm mkrep "$LIB" >/dev/null
mkdir -p "$WK" "$LIB_WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null
cm wk create "$(basename "$LIB_WK")" "$LIB_WK" "$LIB" >/dev/null

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }

# The library: two changesets on main, a label, and branches the rules send changes to.
cd "$LIB_WK"
w Runtime/Physics.cs "public class Physics {}"
w Shaders/Water.shader "Shader \"Water\" {}"
commit "Physics and water"
cm mklabel lb:v1.0 >/dev/null
w Runtime/Physics.cs "public class Physics { float gravity = 9.8f; }"
commit "Gravity"
cm mkbranch main/dev >/dev/null
cm mkbranch main/fix-1 >/dev/null

# The game: branches to write rules for, and the xlinks in a controlled folder.
cd "$WK"
w README.md "# Xlinks demo"
mkdir -p Packages
commit "Game"
cm mkbranch main/task >/dev/null
cm mkbranch main/my-fix >/dev/null
# Git Bash on Windows would turn the folders of the repository ("/", "/Shaders") into paths of its own.
MSYS_NO_PATHCONV=1 cm xlink -w Packages/Engine / "cs:1@$LIB" br:/main-br:/main/dev br:/main/my-fix-br:/main/fix-1 >/dev/null
MSYS_NO_PATHCONV=1 cm xlink Packages/Shaders /Shaders "lb:v1.0@$LIB" >/dev/null
commit "Xlink the engine and its shaders"
cm update >/dev/null
echo "Built $REPO: $WK holds Packages/Engine (writable, two rules) and Packages/Shaders (read-only, /Shaders of $LIB)"
