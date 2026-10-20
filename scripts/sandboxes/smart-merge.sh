#!/usr/bin/env bash
# Builds a branch to merge into main whose Unity prefabs conflict line by line: Player.prefab, where each side added
# its own object (Smart Merge merges it on its own), and Enemy.prefab, renamed differently on each side (Smart Merge
# can't, so the merge tool opens). Needs a Unity Editor installed for Smart Merge. Merge /main/feature from Branches.
# Usage: scripts/sandboxes/smart-merge.sh [repo-name [workspace-folder]]   → repo smartmerge-demo@local, workspace /tmp/uvcs-smartmerge
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the
# workspace always a folder of /tmp.
set -euo pipefail
NAME=${1:-smartmerge-demo}
FOLDER=${2:-uvcs-smartmerge}
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
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s' "$2" > "$1"; }

HEADER='%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
'
# A GameObject with its Transform: id, name, x position, and the children's Transform ids.
object() {
  printf -- '--- !u!1 &%s\nGameObject:\n  m_ObjectHideFlags: 0\n  serializedVersion: 6\n  m_Component:\n  - component: {fileID: %s}\n  m_Layer: 0\n  m_Name: %s\n  m_TagString: Untagged\n  m_IsActive: 1\n' "$1" "$(($1 + 1))" "$2"
  printf -- '--- !u!4 &%s\nTransform:\n  m_ObjectHideFlags: 0\n  m_GameObject: {fileID: %s}\n  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}\n  m_LocalPosition: {x: %s, y: 0, z: 0}\n  m_LocalScale: {x: 1, y: 1, z: 1}\n  m_Children: []\n  m_Father: {fileID: 0}\n' "$(($1 + 1))" "$1" "$3"
}

w Assets/Prefabs/Player.prefab "$HEADER$(object 100 Player 0)
"
w Assets/Prefabs/Enemy.prefab "$HEADER$(object 300 Enemy 0)
"
w Assets/Scripts/Player.cs "public class Player : MonoBehaviour { float speed = 10f; }
"
commit "Base project"

cm branch create /main/feature --changeset >/dev/null 2>&1 || cm mkbr /main/feature >/dev/null
cm switch /main/feature >/dev/null
w Assets/Prefabs/Player.prefab "$HEADER$(object 100 Player 0)
$(object 500 Sword 1)
"
w Assets/Prefabs/Enemy.prefab "$HEADER$(object 300 Goblin 0)
"
w Assets/Scripts/Player.cs "public class Player : MonoBehaviour { float speed = 14f; }
"
commit "Feature: a sword, goblins, a faster player"

cm switch /main >/dev/null
w Assets/Prefabs/Player.prefab "$HEADER$(object 100 Player 0)
$(object 700 Shield -1)
"
w Assets/Prefabs/Enemy.prefab "$HEADER$(object 300 Orc 0)
"
w Assets/Scripts/Player.cs "public class Player : MonoBehaviour { float speed = 9f; }
"
commit "Main: a shield, orcs, a slower player"
echo "Built $REPO in $WK: merge /main/feature into it"
