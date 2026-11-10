#!/usr/bin/env bash
# Builds one workspace of each kind on the same repository: standard, partial (only some folders loaded) and, where
# cm can make one (Windows), dynamic. The home screen, the switcher and the sidebar mark the partial and dynamic ones.
# Usage: scripts/sandboxes/workspace-kinds.sh   → repo workspace-kinds@local, workspaces /tmp/uvcs-kinds-{standard,partial,dynamic}
set -euo pipefail
REPO=workspace-kinds@local
BASE=/tmp/uvcs-kinds

# Deleting the dynamic workspace waits while a program (the app, an editor) still has a file of it open: close them first.
for kind in standard partial dynamic; do
  cm wk delete "$BASE-$kind" >/dev/null 2>&1 || true
  rm -rf "$BASE-$kind"
done
cm rmrep "$REPO" >/dev/null 2>&1 || true
cm mkrep "$REPO" >/dev/null

mkdir -p "$BASE-standard" && cm wk create kinds-standard "$BASE-standard" "$REPO" >/dev/null
cd "$BASE-standard"
mkdir -p Art/Textures Audio Code
printf 'texture\n' > Art/Textures/ship.png
printf 'sound\n' > Audio/engine.wav
printf 'class Ship {}\n' > Code/Ship.cs
cm add -R Art Audio Code >/dev/null
cm ci -c "A ship, its sound and its code" >/dev/null

# A partial workspace: only the code is loaded.
mkdir -p "$BASE-partial" && cm wk create kinds-partial "$BASE-partial" "$REPO" >/dev/null
cd "$BASE-partial"
# MSYS_NO_PATHCONV: Git Bash would turn "+/Code" into a Windows path.
MSYS_NO_PATHCONV=1 cm partial configure "+/Code" --silent

# A dynamic workspace downloads each file the first time it is opened; cm makes them only on Windows, with plasticfs
# running, and takes its path in Windows form there.
mkdir -p "$BASE-dynamic"
DYNAMIC_PATH="$BASE-dynamic"
command -v cygpath >/dev/null && DYNAMIC_PATH="$(cygpath -w "$BASE-dynamic")"
if ! MSYS_NO_PATHCONV=1 cm wk create kinds-dynamic "$DYNAMIC_PATH" --dynamic "--tree=br:/main@$REPO" >/dev/null 2>&1; then
  rm -rf "$BASE-dynamic"
  echo "No dynamic workspace: this cm can't make one here."
fi
echo "Workspaces in $BASE-standard, $BASE-partial and $BASE-dynamic"
