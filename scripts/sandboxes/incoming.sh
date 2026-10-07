#!/usr/bin/env bash
# Builds a workspace three changesets behind its branch, to see Incoming: changes, adds, a delete, a move, files in
# several folders (Lap_2 and Lap_10 for the order), and a local edit to a file the branch changed too (a conflict).
# A second workspace checks the changesets in.
# Usage: scripts/sandboxes/incoming.sh [repo [workspace]]   → repo incoming-demo@local, workspace /tmp/uvcs-incoming
set -euo pipefail
REPO=${1:-incoming-demo@local}
WK=${2:-/tmp/uvcs-incoming}
OTHER="$WK-other"

cm rmrep "$REPO" >/dev/null 2>&1 || true
for wk in "$WK" "$OTHER"; do cm wk delete "$wk" >/dev/null 2>&1 || true; rm -rf "$wk"; done
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" "$OTHER"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null
cm wk create "$(basename "$OTHER")" "$OTHER" "$REPO" >/dev/null

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }

cd "$WK"
for f in PlayerController GameManager Checkpoint Boost HudLabel; do w "Assets/Scripts/$f.cs" "public class $f {}"; done
for f in Speedometer LapCounter Minimap; do w "Assets/Scripts/UI/$f.cs" "public class $f {}"; done
for f in Track01 Track02; do w "Assets/Scenes/$f.unity" "scene $f"; done
w Assets/Materials/Ship.mat "material ship"
w README.md "# Incoming demo"
w docs/controls.md "Arrows to drive."
commit "Initial project"

cd "$OTHER"
cm update >/dev/null
w Assets/Scripts/PlayerController.cs "public class PlayerController { float speed = 14f; }"
w Assets/Scripts/Boost.cs "public class Boost { float cooldown = 2f; }"
w Assets/Scripts/UI/Speedometer.cs "public class Speedometer { bool kmh; }"
commit "Snappier steering and a shorter boost"
w Assets/Scripts/UI/Lap_2.cs "public class Lap_2 {}"
w Assets/Scripts/UI/Lap_10.cs "public class Lap_10 {}"
w Assets/Scenes/Track03.unity "scene Track03"
cm rm Assets/Scenes/Track01.unity >/dev/null
w docs/controls.md "Arrows to drive, space to boost."
commit "Third track, lap widgets, drop the first track"
cm mv Assets/Scripts/HudLabel.cs Assets/Scripts/UI/HudLabel.cs >/dev/null
w Assets/Materials/Ship.mat "material ship v2"
w Assets/Materials/Trail.mat "material trail"
w README.md "# Incoming demo
Now with trails."
commit "Trails, and the HUD label moves to UI"

# A local edit to a file the branch changed: updating merges it.
cd "$WK"
w Assets/Scripts/PlayerController.cs "public class PlayerController { float speed = 9f; }"
echo "Built $REPO: $WK is behind, $OTHER checked in"
