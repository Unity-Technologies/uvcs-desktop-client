#!/usr/bin/env bash
# Builds a partial workspace (only some folders loaded) to update, switch and check in, which the app does with
# `cm partial`: it is two changesets behind on /main, a task branch is there to switch to, and a label and a
# changeset, which a partial workspace can't switch to, are there to be refused. A file it loads is changed, pending.
# Usage: scripts/sandboxes/partial-operations.sh   → repo partial-operations@local, workspace /tmp/uvcs-partial-operations
set -euo pipefail
REPO=partial-operations@local
WORKSPACE=/tmp/uvcs-partial-operations
AUTHOR=/tmp/uvcs-partial-operations-author

for path in "$WORKSPACE" "$AUTHOR"; do
  cm wk delete "$path" >/dev/null 2>&1 || true
  rm -rf "$path"
done
cm rmrep "$REPO" >/dev/null 2>&1 || true
cm mkrep "$REPO" >/dev/null

# Someone else's standard workspace writes the history.
mkdir -p "$AUTHOR" && cm wk create partial-operations-author "$AUTHOR" "$REPO" >/dev/null
cd "$AUTHOR"
mkdir -p Art/Textures Audio Code
printf 'texture\n' > Art/Textures/ship.png
printf 'sound\n' > Audio/engine.wav
printf 'class Ship {}\n' > Code/Ship.cs
printf 'class Engine {}\n' > Code/Engine.cs
cm add -R Art Audio Code >/dev/null
cm ci -c "A ship, its sound and its code" >/dev/null
cm label create lb:v1 >/dev/null

# The partial workspace loads only the code, at this changeset.
mkdir -p "$WORKSPACE" && cm wk create partial-operations "$WORKSPACE" "$REPO" >/dev/null
cd "$WORKSPACE"
# MSYS_NO_PATHCONV: Git Bash would turn "+/Code" into a Windows path.
MSYS_NO_PATHCONV=1 cm partial configure "+/Code" --silent

# Two changesets it doesn't have yet, and a task branch.
cd "$AUTHOR"
printf 'class Ship { int speed; }\n' > Code/Ship.cs
cm ci --all -c "The ship has a speed" >/dev/null
printf 'louder\n' > Audio/engine.wav
printf 'class Hull {}\n' > Code/Hull.cs
cm add Code/Hull.cs >/dev/null
cm ci --all -c "A louder engine, and a hull" >/dev/null
MSYS_NO_PATHCONV=1 cm branch create /main/task-shields >/dev/null
MSYS_NO_PATHCONV=1 cm switch /main/task-shields >/dev/null
printf 'class Shields {}\n' > Code/Shields.cs
cm add Code/Shields.cs >/dev/null
cm ci --all -c "Shields" >/dev/null

# A pending change in the partial workspace, in a file the update doesn't touch.
cd "$WORKSPACE"
printf 'class Engine { int power; }\n' > Code/Engine.cs
echo "Partial workspace in $WORKSPACE: 2 changesets behind, Code/Engine.cs changed; /main/task-shields to switch to, lb:v1 to be refused"
