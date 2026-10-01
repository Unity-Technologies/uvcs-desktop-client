#!/usr/bin/env bash
# Builds a repository whose branches have very long names, to check every place that shows one: deeply nested
# branches, a 120+ character name, a long single segment with no slash to break at, a non-ASCII name, a label and a
# shelve on long branches, code reviews of two of them, and a task branch that conflicts with its parent (the merge
# task dialog's conflict options).
# The workspace ends on the deepest branch.
# Usage: scripts/sandboxes/long-branch-names.sh   → repo long-names@local, workspace /tmp/uvcs-long-names
set -euo pipefail
REPO=long-names@local
WK=/tmp/uvcs-long-names

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create long-names "$WK" "$REPO" >/dev/null
cd "$WK"

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
branch() { cm br create "$1" -c "$2" >/dev/null; cm switch "$1" --noinput >/dev/null; }

w src/Renderer.cs 'class Renderer { int quality = 1; }'
w src/Physics.cs 'class Physics { float gravity = 9.8f; }'
w README.md '# Long names'
cm add -R . >/dev/null
commit "Initial project"

SAMPLE=/main/child-br-cr-sample
TASK=$SAMPLE/empty-branch2/child_1/subtask
LONGEST=/main/rendering-pipeline-integration-with-asset-bundles/shader-variant-stripping-regression-after-upgrading-to-unity-6/hotfix
SINGLE=/main/ThisBranchNameHasOneLongSegmentWithNoSlashToBreakAtAsSomeTeamsNameBranchesAfterTheirWholeTicketTitle
UNICODE=/main/características-del-niño/日本語のブランチ名-テスト

branch $SAMPLE "A sample branch with child branches"
w src/Renderer.cs 'class Renderer { int quality = 2; }'
commit "Raise the render quality"
branch $SAMPLE/empty-branch2 "An intermediate branch"
branch $SAMPLE/empty-branch2/child_1 "One level deeper"
w src/Physics.cs 'class Physics { float gravity = 9.81f; }'
commit "More precise gravity"
branch $TASK "The task's parent"
w src/Renderer.cs 'class Renderer { int quality = 3; }'
w src/Physics.cs 'class Physics { float gravity = 9.80665f; }'
commit "Tune quality and gravity"

# The task branch changes the same two files as its parent does afterwards, so merging it conflicts.
branch $TASK/merge-test "A task that conflicts with its parent"
w src/Renderer.cs 'class Renderer { int quality = 4; bool shadows = true; }'
w src/Physics.cs 'class Physics { float gravity = 10f; }'
commit "Shadows and arcade gravity"
cm switch $TASK --noinput >/dev/null
w src/Renderer.cs 'class Renderer { int quality = 5; }'
w src/Physics.cs 'class Physics { float gravity = 9.8f; float drag = 0.1f; }'
commit "Highest quality and drag"

cm switch /main --noinput >/dev/null
# A child branch's parents must exist first.
branch "$(dirname "$(dirname $LONGEST)")" "The rendering pipeline's integration"
branch "$(dirname $LONGEST)" "The shader regression"
branch $LONGEST "A branch named over 120 characters"
w src/Shaders.cs 'class Shaders { }'
cm add src/Shaders.cs >/dev/null
commit "Keep the shader variants the upgrade stripped"
cm label create lb:shader-variant-stripping-hotfix-candidate-for-the-unity-6-upgrade -c "Hotfix candidate" >/dev/null
w src/Shaders.cs 'class Shaders { bool keepVariants = true; }'
cm shelveset create --all -c "Work in progress on the variants" >/dev/null
cm undo -r . >/dev/null

cm switch /main --noinput >/dev/null
branch $SINGLE "One long segment"
w README.md '# Long names, one segment'
commit "Document the single segment"

cm switch /main --noinput >/dev/null
branch "$(dirname "$UNICODE")" "Características"
branch "$UNICODE" "Non-ASCII names"
w README.md '# Nombres largos — 長い名前'
commit "Nombres y 名前"

cm codereview "br:$LONGEST" "Review the shader variant hotfix" >/dev/null
cm codereview "br:$SINGLE" "Review the long segment" >/dev/null

cm switch $TASK/merge-test --noinput >/dev/null
echo "Sandbox ready at $WK, on $TASK/merge-test"
