#!/usr/bin/env bash
# Builds a repository with a task branch per merge request case (docs/features/merge-requests.md): no request; a
# draft; open with no reviewers; open under review; open in rework with two change requests and a question open; open
# and reviewed, merging cleanly; open and reviewed, conflicting with /main; closed; merged (merged on the server with
# `cm merge --to`, then recorded Merged, as the app does where the server doesn't); merged, its branch hidden since;
# one closed and one open request of the same branch; a nested branch, /main/release/task-nested, into /main/release;
# a request whose destination was changed from /main/release to /main. And plain code reviews: of a branch, of a
# changeset and of a shelve. The workspace ends on /main.
# Usage: scripts/sandboxes/merge-requests.sh [repo-name [workspace-folder]]   → repo merge-requests@local, workspace /tmp/uvcs-merge-requests
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the workspace
# always a folder of /tmp.
set -euo pipefail
NAME=${1:-merge-requests}
FOLDER=${2:-uvcs-merge-requests}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"
TEXTS=$(mktemp -d)
trap 'rm -rf "$TEXTS"' EXIT

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

# Texts are read from files: `-c` can't hold lines.
text() { printf '%s\n' "$2" > "$TEXTS/$1"; echo "$TEXTS/$1"; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
checkin() { cm ci --all --private -c="$1" >/dev/null; }
changeset() { cm find "changeset where branch = '$1'" "order by changesetid desc" limit 1 --format={changesetid} --nototal; }
# A task branch off a parent, with one changeset of its own: `task <branch> <file> <content> <comment>`.
task() {
  cm switch "br:$(dirname "$1")" >/dev/null
  cm mkbr "br:$1" -c="$4" >/dev/null
  cm switch "br:$1" >/dev/null
  w "$2" "$3"
  checkin "$4"
}
# A merge request: `request <branch> <destination> <title> [cm mr create options]`; prints its number.
request() {
  local branch=$1 destination=$2 title=$3
  shift 3
  cm mr create "br:$branch" "$title" --destination="br:$destination" --format={id} "$@"
}
state() { cm mr edit "$1" --mergerequeststatus="$2" "${@:3}" >/dev/null; }

cd "$WK"
w Assets/Scripts/Player.cs "public class Player { }"
w README.md "# Merge requests"
checkin "Initial project"
cm mkbr br:/main/release -c="The next release" >/dev/null
cm switch br:/main/release >/dev/null
w Assets/Scripts/Release.cs "public static class Release { public const string Version = \"1.0\"; }"
checkin "Release version"

task /main/task-none Assets/Scripts/Jump.cs "public class Jump { }" "Jump, no request yet"

task /main/task-draft Assets/Scripts/Crouch.cs "public class Crouch { }" "Crouch"
request /main/task-draft /main "Crouch" --mergerequeststatus=Draft >/dev/null

task /main/task-open-new Assets/Scripts/Swim.cs "public class Swim { }" "Swim"
request /main/task-open-new /main "Swim" --descriptionfile="$(text swim 'Adds swimming. Needs a reviewer.')" >/dev/null

task /main/task-open-review Assets/Scripts/Climb.cs "public class Climb { }" "Climb"
request /main/task-open-review /main "Climb walls" --users=me >/dev/null

task /main/task-rework Assets/Scripts/Dash.cs "public class Dash
{
    public float Speed = 12;
}" "Dash"
REWORK=$(request /main/task-rework /main "Dash" --users=me)
cm cr comment add "$REWORK" --path=/Assets/Scripts/Dash.cs --line=3 --type=Change -c="Make the speed a constant." >/dev/null
cm cr comment add "$REWORK" --path=/Assets/Scripts/Dash.cs --line=1 --type=Change -c="Seal the class." >/dev/null
cm cr comment add "$REWORK" --path=/Assets/Scripts/Dash.cs --line=3 --type=Question -c="Why 12?" >/dev/null
cm cr review "$REWORK" --rework-required -c="Two changes first." >/dev/null

task /main/task-reviewed Assets/Scripts/Slide.cs "public class Slide { }" "Slide"
REVIEWED=$(request /main/task-reviewed /main "Slide" --users=me)
cm cr review "$REVIEWED" --reviewed -c="Ready." >/dev/null

task /main/task-conflict README.md "# Merge requests, from the task" "Explain the task in the README"
CONFLICT=$(request /main/task-conflict /main "Explain the task" --users=me)
cm cr review "$CONFLICT" --reviewed >/dev/null

task /main/task-closed Assets/Scripts/Fly.cs "public class Fly { }" "Fly"
state "$(request /main/task-closed /main "Fly")" Closed

task /main/task-merged Assets/Scripts/Run.cs "public class Run { }" "Run"
MERGED=$(request /main/task-merged /main "Run")
cm merge br:/main/task-merged --to=br:/main --merge -c="Merge /main/task-merged: Run" >/dev/null
# A server with merge requests switched on marks it Merged by itself; the local one may not: record it as the app does.
state "$MERGED" Merged --mergechangeset="cs:$(changeset /main)"

# Merged, its branch hidden afterwards: the merge card offers to show it again.
task /main/task-merged-hidden Assets/Scripts/Kick.cs "public class Kick { }" "Kick"
MERGED_HIDDEN=$(request /main/task-merged-hidden /main "Kick")
cm merge br:/main/task-merged-hidden --to=br:/main --merge -c="Merge /main/task-merged-hidden: Kick" >/dev/null
state "$MERGED_HIDDEN" Merged --mergechangeset="cs:$(changeset /main)"
cm switch br:/main >/dev/null
cm branch hide br:/main/task-merged-hidden >/dev/null

task /main/task-twice Assets/Scripts/Roll.cs "public class Roll { }" "Roll"
state "$(request /main/task-twice /main "Roll, first try")" Closed
request /main/task-twice /main "Roll" >/dev/null

task /main/release/task-nested Assets/Scripts/Patch.cs "public class Patch { }" "Patch the release"
request /main/release/task-nested /main/release "Patch the release" >/dev/null

task /main/task-moved Assets/Scripts/Wave.cs "public class Wave { }" "Wave"
MOVED=$(request /main/task-moved /main/release "Wave")
cm mr edit "$MOVED" --destination=br:/main >/dev/null

task /main/task-plain Assets/Scripts/Sit.cs "public class Sit { }" "Sit"
cm cr br:/main/task-plain "Sit, a plain code review" --users=me >/dev/null

# Changed on /main after the conflicting task branched, so merging it conflicts.
cm switch br:/main >/dev/null
w README.md "# Merge requests, on main"
checkin "Explain merge requests in the README"
cm cr "cs:$(changeset /main)" "README on main" --users=me >/dev/null

w Assets/Scripts/Player.cs "public class Player { public int Lives = 3; }"
cm shelveset create --all -c="Lives" >/dev/null
SHELVE=$(cm find shelve --format={shelveid} --nototal | tail -n 1)
cm cr "sh:$SHELVE" "Lives, shelved" >/dev/null
cm undo -r . >/dev/null

echo "Repository $REPO, workspace $WK on /main"
