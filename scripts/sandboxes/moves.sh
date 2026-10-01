#!/usr/bin/env bash
# Builds a repository whose last changeset and pending changes hold every kind of move: to a deeper folder, to a
# sibling folder, a rename, a move and rename, from and to the root, and moves whose content changed too.
# Usage: scripts/sandboxes/moves.sh   → repo moves-demo@local, workspace /tmp/uvcs-moves-demo
set -euo pipefail
REPO=moves-demo@local
WK=/tmp/uvcs-moves-demo

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create moves-demo "$WK" "$REPO" >/dev/null
cd "$WK"

# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { mkdir -p "$(dirname "$1")"; printf '%s\n' "class $(basename "$1" .cs) {}" > "$1"; }
mv_() { mkdir -p "$(dirname "$2")"; cm add --parents "$(dirname "$2")" >/dev/null 2>&1 || true; cm mv "$1" "$2" >/dev/null; }
append() { sleep 1; printf '// %s\n' "$2" >> "$1"; }

MERGE=src/nunit/nunitclient/merge
for name in MatchMergeToFileConflictResolutionsTests MergeToFileConflictCleanerTests ParseMergeToFileConflictResolutionsTests; do w "$MERGE/$name.cs"; done
for name in MatchMergeToFileConflictResolutions MergeToFileConflictResolution; do w "src/client/basecommands/merge/mergeto/$name.cs"; done
for name in Renamed MovedAndRenamed Sibling Rooted Plain Edited Plié; do w "src/lib/$name.cs"; done
LONG_FROM=assets/art/characters/heroes/legacy-prototypes/rigging-experiments-2019/controllers
LONG_TO=tools/build/pipelines/generated-importers/animation-retargeting/runtime-adapters
w "$LONG_FROM/HumanoidAnimationRetargetingControllerForLegacyRigs.cs"
w TopLevel.cs
w src/lib/Ünïcødé/Größe.cs
mkdir -p src/app src/tools
cm add -R . >/dev/null
cm ci --all -c "Initial layout" >/dev/null

# Checked in: what a changeset's diff shows.
mv_ "$MERGE/MatchMergeToFileConflictResolutionsTests.cs" "$MERGE/mergeto/fileconflictsresolution/MatchMergeToFileConflictResolutionsTests.cs"
mv_ "$MERGE/MergeToFileConflictCleanerTests.cs" "$MERGE/mergeto/MergeToFileConflictCleanerTests.cs"
mv_ src/lib/Renamed.cs src/lib/RenamedAgain.cs
mv_ src/lib/MovedAndRenamed.cs src/app/NowElsewhere.cs
mv_ TopLevel.cs src/tools/TopLevel.cs
mv_ src/lib/Ünïcødé/Größe.cs src/lib/Ünïcødé/Maße.cs
append "$MERGE/mergeto/MergeToFileConflictCleanerTests.cs" "changed after the move"
append src/lib/Edited.cs "a plain change"
cm ci --all -c "Move the merge-to tests next to the code they test" >/dev/null

# Pending: what Changes shows.
sleep 1
mv_ "$MERGE/ParseMergeToFileConflictResolutionsTests.cs" "$MERGE/mergeto/fileconflictsresolution/ParseMergeToFileConflictResolutionsTests.cs"
mv_ src/client/basecommands/merge/mergeto/MatchMergeToFileConflictResolutions.cs src/client/basecommands/merge/mergeto/fileconflictsresolution/MatchMergeToFileConflictResolutions.cs
mv_ src/lib/Sibling.cs src/app/Sibling.cs
mv_ src/lib/Rooted.cs Rooted.cs
mv_ src/lib/Plié.cs src/lib/Pliée.cs
mv_ "$LONG_FROM/HumanoidAnimationRetargetingControllerForLegacyRigs.cs" "$LONG_TO/HumanoidAnimationRetargetingControllerForLegacyRigs.cs"
append "$MERGE/mergeto/fileconflictsresolution/ParseMergeToFileConflictResolutionsTests.cs" "changed after the move"
append src/app/Sibling.cs "changed after the move"
append src/lib/Plain.cs "a plain change"
cm co src/lib/Plain.cs >/dev/null 2>&1 || true
echo "Built $REPO in $WK"
