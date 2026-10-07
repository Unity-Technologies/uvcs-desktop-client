#!/usr/bin/env bash
# Builds a branch to merge into main with every kind of item the merge page lists: files changed on both sides
# (conflicts), an item added on both sides with the same name and a file one side moved while the other deleted it
# (directory conflicts), and changes that apply cleanly in several folders. Merge /main/feature from the Branches view.
# Usage: scripts/sandboxes/merge-conflicts.sh [repo-name [workspace-folder]]   → repo merge-demo@local, workspace /tmp/uvcs-merge-demo
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the
# workspace always a folder of /tmp.
set -euo pipefail
NAME=${1:-merge-demo}
FOLDER=${2:-uvcs-merge-demo}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null
cd "$WK"

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }

w src/game/Player.cs "public class Player
{
    float speed = 10f;
    float jump = 4f;
}"
w src/game/Enemy.cs "public class Enemy { int health = 3; }"
w src/ui/Hud.cs "public class Hud {}"
w src/ui/Menu.cs "public class Menu {}"
w docs/readme.md "# Merge demo"
w assets/old/Legacy.cs "public class Legacy {}"
commit "Base project"

cm branch create /main/feature --changeset >/dev/null 2>&1 || cm mkbr /main/feature >/dev/null
cm switch /main/feature >/dev/null
w src/game/Player.cs "public class Player
{
    float speed = 14f;
    float jump = 4f;
}"
w src/game/Enemy.cs "public class Enemy { int health = 5; }"
w src/ui/Hud.cs "public class Hud { bool visible; }"
w src/ui/widgets/Lap_2.cs "public class Lap_2 {}"
w src/ui/widgets/Lap_10.cs "public class Lap_10 {}"
w docs/controls.md "Arrows to drive."
w src/shared/Config.cs "public class Config { string from = \"feature\"; }"
cm mv assets/old/Legacy.cs assets/Legacy.cs >/dev/null
cm rm src/ui/Menu.cs >/dev/null
commit "Feature: faster player, new widgets, shared config"

cm switch /main >/dev/null
w src/game/Player.cs "public class Player
{
    float speed = 9f;
    float jump = 4f;
}"
w src/game/Enemy.cs "public class Enemy { int health = 2; }"
w src/shared/Config.cs "public class Config { string from = \"main\"; }"
cm rm assets/old/Legacy.cs >/dev/null
commit "Main: slower player, its own shared config, no legacy code"
echo "Built $REPO in $WK: merge /main/feature into it"
