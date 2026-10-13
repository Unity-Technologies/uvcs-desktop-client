#!/usr/bin/env bash
# Builds a small Unity project whose history holds one changeset per 3D model diff case: a re-export where nothing
# Unity sees changed, the wrong units, a turned root, a moved pivot, a renamed and reshaped hierarchy, renamed
# material slots, a sculpt, more polygons, new UVs, a model added and one deleted; a branch with several models
# changed; an animated GLB character whose takes change; a glTF with its geometry in a .bin beside it; import
# settings changed in a .meta alone (the scale, a clip cut past its take's end); a branch that conflicts with /main on
# a GLB; textured props, one per way Unity finds a model's materials and textures (beside it, in a Textures folder,
# remapped to a .mat with PSD and PNG maps, an alpha-clipped leaf card, a glTF's and a GLB's images, a texture missing);
# and a model edited and not checked in. The models are written by models/writeModels.ts, one step each.
# Usage: scripts/sandboxes/models.sh   (from the repository root) → repo models@local, workspace /tmp/uvcs-models
set -euo pipefail
REPO=models@local
WK=/tmp/uvcs-models
ROOT=$(pwd)
GENERATOR=$(mktemp -d)/writeModels.mjs

npx esbuild scripts/sandboxes/models/writeModels.ts --bundle --platform=node --format=esm \
  --alias:@shared=./src/shared --outfile="$GENERATOR" --log-level=warning

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create models "$WK" "$REPO" >/dev/null
cd "$WK"

commit() { cm ci --all --private -c "$1" >/dev/null; }
# Writes the project as it stands after a step of writeModels.ts. cm detects edits by timestamp, so edits in the
# same second as the last checkin would be missed.
models() { sleep 1; node "$GENERATOR" "$1" "$WK"; }
step() { models "$1"; commit "$2"; }

step initial "Imported the first props and the robot: crate, rock, barrel and a placeholder cube"
step reexport "Re-exported the crate and the rock from Blender 4.2.3"
step crate-centimetres "Re-exported the crate from Blender in centimetres"
step rock-turned "Re-exported the rock without applying Blender's rotation"
step crate-pivot "Moved the crate lid's pivot to its hinge"
step robot-hierarchy "Renamed the robot's left hand, put the helmet on the head, dropped the backpack, added an antenna"
step crate-slots "Renamed the crate's wood material and gave it a label"
step rock-sculpt "Sculpted a ledge on one side of the rock"
step rock-polycount "Subdivided the rock for close-ups"
step barrel-uvs "Unwrapped the barrel again into one atlas"
step lantern-replaces-cube "Replaced the placeholder cube with the lantern"

cm br create /main/art-pass -c "Art pass on the props and the robot" >/dev/null
cm switch /main/art-pass --noinput >/dev/null
step art-barrel "Rounded the barrel with more staves"
step art-fingers "Rigged the robot's fingers"
step art-lantern "Made the lantern bigger so it reads from the game camera"
cm switch /main --noinput >/dev/null

step scout "Imported the scout from Blender as GLB: rigged, with an idle and a wave"
step scout-snappier "Made the wave snappier and added a jump"
step barrel-gltf "Exported the barrel as glTF for the web build, its geometry in Barrel.bin"
step barrel-gltf-taller "Made the glTF barrel taller"
step crate-import-scale "Scaled the crate up in its import settings instead of exporting it again"
step robot-animated "Animated the robot in one take, split into an Idle and a Wave clip"
step robot-wave-clip "Let the robot's Wave clip run on to frame 120"
step lamp "Added a standing lamp"

# A branch and /main each change the lamp after it was added: merging the branch conflicts on the GLB.
cm br create /main/conflict-lamp -c "Lamp rework, to merge into /main" >/dev/null
cm switch /main/conflict-lamp --noinput >/dev/null
step lamp-taller "Made the lamp taller"
cm switch /main --noinput >/dev/null
step lamp-wider "Gave the lamp a wider shade"
step textured "Added textured props: a tree, a supply crate, a boulder, a bench, a fern, a sign and a floor tile"
step textured-tree-taller "Made the tree taller"

# Pending: what Changes shows.
models pending
cd "$ROOT"
echo "Built $REPO in $WK"
echo "To see a conflict on a model: merge /main/conflict-lamp into /main (both changed Assets/Models/Props/Lamp.glb)"
