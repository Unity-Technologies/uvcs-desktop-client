# Model diffs

How the diff shows 3D models (`features/diff/viewer/model`): an FBX, OBJ, glTF or GLB that changed is shown as the
image diff shows a texture, in 3D, with what changed told as Unity will take it. A Unity project's models break it in
ways no picture shows (a model 100× too big, a GameObject renamed under the prefab overrides that pointed at it), so
the panel matters as much as the view.

## Reading a model

`toFileContent` (main) keeps a model's bytes by extension (`FileContent.model`: `ModelBytes`, its `ModelFormat`), up
to `MAX_MODEL_BYTES` a side (100 MB: a character with its takes runs 50-150 MB as FBX); past that, `tooLarge: 'model'`.
OBJ, `.gltf` and ASCII FBX are text too, while small enough to diff (`MAX_TEXT_BYTES`): they get "Code | Model"
(`RepresentationSwitch`, remembered per extension, rendered by default), and unsaved edits typed into the text are
parsed and shown (`renderedEdits`). No `cm` command is added: a model is read by the same `cm cat` (or disk read) as any
file.

The renderer parses in a worker (`modelParse.worker`, through `modelParseSession`: one worker for the app's life, the
main thread when it can't start), once per version's bytes (a `WeakMap` on them), and gets back plain data:
`ParsedModel`, its arrays transferred. The bytes are copied to the worker, never transferred: the content cache keeps
them. A 2M-triangle FBX takes about 1.7 s to parse and 0.3 s to sum up, never on the UI thread.

`parseModel` reads through three.js's loaders (`FBXLoader`, `OBJLoader`, `GLTFLoader`), and corrects them where Unity
reads a file otherwise:

- **Nothing outside the file loads** (`noTextureLoading`): every texture goes to one handler that records its file
  name (`ParsedModel.textures`) and loads nothing, and every other URL becomes an empty one; only `data:` and the
  loader's own `blob:` URLs (the file's bytes) read. It is also what lets the loaders run without a DOM.
- **Names are the file's**: FBXLoader renames nodes for its animation bindings (`Hand L` becomes `Hand_L`); the
  file's name, which is Unity's GameObject's, is in `userData.originalName` (`fromThreeObject`).
- **Units and axes as Unity converts them** (`fbxProperties`, `fbxAxes`): FBXLoader ignores `UnitScaleFactor` and turns
  a Z-up file by -90° on X whatever its front axis. The FBX's global settings are read from its bytes (ASCII or binary
  property records), the loader's turn is taken back, and the whole axis system (up, front, coord, each with its sign)
  is converted (`axisConversion`); units become metres (`unitScale`: an FBX in centimetres is 0.01). Unity's X mirror
  (right-handed files become left-handed) is applied to the numbers told (`unitySpaceOf`), not to the picture: Unity's
  left-handed camera over mirrored coordinates shows what three's right-handed one shows of the file's own
  (`viewerSpaceOf`). FBXLoader also sizes a camera of the file from `window`, which a worker hasn't
  (`withCameraWindow`).
- **OBJ line elements are dropped** (`withoutLineElements`): OBJLoader turns an object with any `l` into lines only,
  losing its faces; Unity imports the faces.
- **A glTF that needs more than its bytes says so** (`gltfNeed`): a buffer in a `.bin` beside it, or Draco or meshopt
  compression, which the viewer has no decoder for (`modelReadFailureWords`).

Checked against Unity 6000.3's own import of six real exports (Blender's, a Z-up one among them): sizes and centres
match to the centimetre; Unity's `Renderer.bounds` only differ where a node is rotated, as they box a box.

## What a version is (`modelSummary`)

What Unity would show of one version: each node by its path under the model (`Armature/Hips/Spine`, as
`transform.Find` and animation curves take them; siblings of one name keyed apart with ` #2`), its world matrix and
bounds in Unity's space, and each mesh's triangles, material slots, blendshapes, bones and attribute fingerprints.

- **Vertices about as Unity counts them** (`countUniqueVertices`): the corners that share every attribute weld into
  one, normals within `NORMAL_WELD_STEP` (exporters write split normals with float noise). Unity's own count also
  splits vertices for the tangents it computes, so it differs by a few percent; the strip's tooltip says "about".
- **Material slots are those some triangle uses**: Unity makes submeshes only of those (a file declaring 17 materials
  Unity shows as 14).
- **Fingerprints** of each attribute's exact values tell what changed without keeping both versions' arrays, and
  `placedPositions` (where the vertices end up in Unity's space, to 10 µm) tells a mesh whose vertices were shifted to
  stay in place (a pivot moved, a new parent) from one whose shape changed.

## What changed (`modelChanges`, `nodeMatching`, `modelChangeWords`)

`matchNodes` pairs the versions' nodes as Unity binds them: by name under the matched parent; then, among siblings left
over, by likeness (the same mesh, the same transform, the same children's names; a tie tells nothing, but the one
leftover of a kind on each side is a rename); then by name anywhere (moved to another parent). Children of a renamed or
moved node are matched under it, so renaming `Arm_L` is one rename, not every bone under it removed and added.

`modelChanges` tells, risks first (`isRisk`):

- **The whole model**: resized (with its units as the cause when they changed), turned (around X, Y or Z when it is),
  moved off its pivot. Told from what every matched mesh agrees on (their placement, or where their geometry went for
  meshes still made the same way), never from the overall bounds, so adding a backpack isn't a resize and subdividing
  a rock isn't a move. A resize must grow every axis alike: a sculpted ledge is a shape change.
- **The hierarchy**: renamed, moved, removed (once, at the top of what went), added; nodes moved, turned or scaled on
  their own; a node's pivot moved (the node moved, its geometry stayed). A unit change made up for in the root's scale
  moves nothing in Unity and isn't listed.
- **Material slots**, model-wide as Unity remaps them by name: renamed (a name gone and another come in the same slot
  of the same mesh), removed, added; a mesh that uses another of the model's slots.
- **Each mesh**: triangles (and nothing else then: a rebuilt mesh changed everything), shape, normals, UVs, lightmap
  UVs (lost is a risk: baked lighting needs them), vertex colors, skinning, blendshapes renamed, removed or added.
- **Takes** (Unity's clips are cut from them by name): renamed (one gone and one of the same length come), removed,
  added, of another length. **Textures** the materials name, the **up axis**, the **exporting app** (all a re-export
  with nothing else changed tells: the panel says "Nothing Unity imports changed" when there's nothing at all).

`changeRows` words them for the panel, with the line on why a risk matters in Unity, and folds three or more of a kind
(`FOLD_FROM`: "Added 6 bones") into one row listing them. Lengths read in the unit that suits them (`formatLength`).

## The view

One `ModelRenderer` per viewer draws on one WebGL canvas, only when something changes (`requestRender`: a gesture, a
mode, a look), never on a loop; disposing it frees the GPU's memory at once (`forceContextLoss`), as stepping through
files makes many viewers. Each version is a scene of its own (`buildModelScene`: its hierarchy, a material per slot, a
wireframe twin sharing the geometry) under one camera (`orbitCamera`), laid out per mode (`layoutOf`):

- **Split**: a half each, before on the left. **Swipe**: both through one full view, each cut at the divider
  (`SwipeDivider`, the image swipe's). **Onion**: each version drawn apart, cleared transparent, and blended
  (`Blender`): it tone maps what was drawn and lays it over the backdrop, so the onion looks as the other modes do and
  blends what is seen, not the meshes' depths; Play blinks (`BlendPill`, the image onion's). A version alone (added,
  deleted) takes the whole canvas. Modes are the image diff's, remembered apart (`modelMode`).
- **Framing**: both versions together (`framedBounds`), once both are read: framing one alone framed a pair whose other
  half was 100 times its size. Until the user moves the camera, the model stays framed as the stage resizes and the
  panel docks.
- **Controls** (`useOrbitGestures`), as Unity's Scene view: drag (or Alt+drag) orbits, right, middle or Shift+drag pans,
  scroll or pinch zooms at the point under the pointer, double-click orbits around the point clicked, a click picks the
  part under it and its match on the other side. F frames what is picked, or the whole model; 0 the whole model
  (`modelKeys`, in the shortcut registry). Draw modes are Unity's (Shaded, Wireframe, Shaded wireframe), and material
  slots can show in their colors (`slotColor`: the avatar fills by name, so a renamed slot changes color).
- **The scene**: clay lit by a soft studio (three's `RoomEnvironment`) and a key light over the camera's shoulder;
  a ground grid a power of ten apart that suits the model (1 m for a person), X and Z through the origin in Unity's
  axis colors; each version's pivot axes, turned as the node every mesh hangs under. A picked node with no geometry
  (a bone, an empty) shows as a dot on top of everything, framed with a third of the model around it. Colors come from
  `tokens.css` (`readModelPalette`, read again as the theme changes).
- **"What changed"** (`ModelChangesPanel`): open, beside a pane at least `ROOMY_PANE` wide it is a column of its own;
  narrower, or folded, it floats at the stage's top right (under the onion's pill). A row picked frames and lights up
  its nodes on both sides; the rest fade. **The info strip** (`modelStats`): Tris, Verts, materials, bones,
  blendshapes, animations and size, "before → after" where they changed, both sizes in one unit.

## Sandbox

`scripts/sandboxes/models.sh` builds `models@local` (workspace `/tmp/uvcs-models`): a changeset per case above (a
re-export, wrong units, a turn, a pivot, hierarchy edits, material slots, a sculpt, a polycount, UVs, added and deleted
models), a branch of model changes and a pending one. Its FBX files are ASCII, written by `testing/asciiFbx`, which
tests use too.
