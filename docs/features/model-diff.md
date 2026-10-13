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

The renderer parses in a worker (`model.worker`, through `modelWorkerSession`: one worker for the app's life, the
main thread when it can't start), once per version's bytes (a `WeakMap` on them), and gets back plain data:
`ParsedModel`, its arrays transferred. The bytes are copied to the worker, never transferred: the content cache keeps
them. A 2M-triangle FBX takes about 1.7 s to parse and 0.3 s to sum up, never on the UI thread.

`parseModel` reads through three.js's loaders (`FBXLoader`, `OBJLoader`, `GLTFLoader`), and corrects them where Unity
reads a file otherwise:

- **Nothing outside the file loads** (`noTextureLoading`): every texture goes to one handler that records its file
  name (`ParsedModel.textures`) and loads nothing, and every other URL becomes an empty one; only `data:` and the
  loader's own `blob:` URLs (the file's bytes) read. It is also what lets the loaders run without a DOM. A glTF's
  images held in the file go there too (`texturesNamedOnly`, a GLTFLoader plugin): its own image loader decoded them
  in full in the worker, for nothing.
- **Materials as the file defines them** (`fileMaterialsOf`, `ParsedModel.materials`, `ModelMesh.slotMaterials`):
  each material once, by itself and not by name (a glTF's may all be unnamed), with its color, opacity, alpha mode,
  sides, and the texture each map names: an FBX's by the paths it stores (`readFbxTextureFiles`, by the Texture
  object's id that FBXLoader sets as `texture.ID`, ASCII and binary), a glTF's by its image (`gltfTextureSource`). They
  change nothing the diff tells: only the Materials look reads them.
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
- **An FBX older than 7.0 says so** (`oldFbx`, by the binary header's version or ASCII `FBXVersion`): FBXLoader reads
  FBX 2011 (7.0) and later, while Unity still imports older ones. Some files FBXLoader can't read at all (it throws in
  `buildSkeleton` on a skin whose bones it can't place, or on content of an old exporter in a 7.x container, as
  BoatAttack's `Renegade.fbx`): they show "Couldn't display this model", a known limit of the loader.
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
- **Where a vertex is, is where it is drawn** (`placedPositionsOf`): through its node, or, skinned, through its bones
  at rest as its file bound them (`bone's world × inverse bind × bind matrix`). The bounds, the size in the strip and
  the Differences mode's measure all read it, so a weapon bound upright and held across by the rest pose is measured
  across, as Unity shows it.

## What changed (`modelChanges`, `nodeMatching`, `modelChangeWords`)

`matchNodes` pairs the versions' nodes as Unity binds them: by name under the matched parent; then, among siblings left
over, by likeness (the same mesh, the same transform, the same children's names; a tie tells nothing, but the one
leftover of a kind on each side is a rename); then by name anywhere (moved to another parent). Children of a renamed or
moved node are matched under it, so renaming `Arm_L` is one rename, not every bone under it removed and added.

`modelChanges` tells, risks first (`isRisk`):

- **The whole model**: resized (with its units as the cause when they changed), turned (around X, Y or Z when it is),
  moved off its pivot. Told from what every matched mesh agrees on (their placement, or where their geometry went for
  meshes still made the same way), never from the overall bounds, so adding a backpack isn't a resize and subdividing
  a rock isn't a move. A resize must grow every axis alike: a sculpted ledge is a shape change. A mesh's placement
  (`MeshSummary.placement`, `restingPlacementOf`) is its node's world, or, skinned, where its top-most joint carries
  the bound mesh: a skinned glTF turned or scaled from above its skeleton is told so, and one whose mesh node alone
  turned (which places nothing) isn't. The top-most joint, not the heaviest: it carries the whole skeleton and
  repainting weights doesn't move it; a rest pose turning it reads as the whole model turned, as Unity shows it. Where geometry went is told by rigid meshes: a skinned
  one goes where its bones hold it, so a bone whose rest pose moved is told as that bone, not as the model moved off
  its pivot. A skinned mesh made the same way must still agree, so a hat scaled or moved beside a body that stayed is
  no whole-model change.
- **The hierarchy**: renamed, moved, removed (once, at the top of what went), added; nodes moved, turned or scaled on
  their own; a node's pivot moved (the node moved, its geometry stayed; not told of a skinned mesh's node, whose
  pivot skins nothing). A unit change made up for in the root's scale
  moves nothing in Unity and isn't listed.
- **Material slots**, model-wide as Unity remaps them by name: renamed (a name gone and another come in the same slot
  of the same mesh), removed, added; a mesh that uses another of the model's slots.
- **Each mesh**: triangles (and nothing else then: a rebuilt mesh changed everything), shape, normals, UVs, lightmap
  UVs (lost is a risk: baked lighting needs them), vertex colors, skinning, blendshapes renamed, removed or added.
- **Takes** (Unity's clips are cut from them by name): renamed (one gone and one of the same length come), removed,
  added, of another length. **Textures** the file's materials name (where materials aren't told, below), the **up
  axis**, the **exporting app** (all a re-export with nothing else changed tells: the panel says "Nothing Unity imports
  changed" when there's nothing at all).
- **Materials as Unity resolves them** (`materialChanges`, worded by `materialChangeWords`), compared from both
  versions' plans (`planVersion`'s `resolved`, "Materials" below), each slot both versions have (a glTF's materials,
  keyed by their place in the file, paired by name instead, and only where both files name one material so:
  `pairedSlots`; its images held in the file are compared by their place, never their content): where it takes its
  material from (Unity's default; a project's `.mat`, by its GUID, one of the same name elsewhere named by its folder, a
  registry package's in `Library/PackageCache` named the package's; the model's own; a remap to a material the project
  hasn't: Unity's missing material, a risk), and, for the same material, its base map, normal map, base color (as the
  Inspector shows it, `#RRGGBB`), alpha (opaque, cutout, transparent), alpha cutoff, opacity (in whole percents, as
  told), sides and the base map's tiling and offset; and a texture it now uses that the workspace hasn't (a risk; one it
  lacked before isn't news). The workspace's materials read alike for both versions, so a `.mat` changed alone never
  shows here: its own diff is its text. They're told with the Materials look off too, from the very reads the look makes
  (one query each, shared): only for versions whose materials may resolve differently (`materialsMayDiffer`: their
  slots' sources or their lookups differ), so a re-export that changed no material reads nothing, and never decoding a
  texture. Waiting for the look to resolve them was rejected: a change is a change, and the reads are the workspace's
  disk, no `cm` command; the one cost, a GUID the project lacks, reads the project's index once, as the look would.
  They're not told (`materialChangesOf` is null) without a workspace, for a version with no path in it or whose `.meta`
  read failed (`comparableVersions`), or when the workspace couldn't answer for a side (`answerStateOf`): a find that
  failed, a file the disk refused to check (only `ENOENT` and `ENOTDIR` say a file isn't there: `foundFile`), or a GUID
  not found that can't be told missing (`UnityAssetsAnswer.guidMisses`: a model outside a Unity project, as in a
  package's own repository, or in a project without a `Library`, never opened in Unity on this machine, "The project's
  index" below). Then the file's own list of textures named (`textures`) stands in, and where the materials may have
  changed (`materialsMayDiffer`) a note says they weren't compared and why ("Materials not compared": open the project
  in Unity once on this computer; the project's files couldn't all be read; the model isn't in a Unity project;
  `materialsNotComparedOf`), so the panel never says nothing changed; where they are told, or being read, it goes, as
  the materials say which textures Unity uses (`whatChanged`).

`changeRows` words them for the panel, with the line on why a risk matters in Unity, and folds three or more of a kind
(`FOLD_FROM`: "Added 6 bones") into one row listing them; material rows count slots ("3 slots now transparent"), and
a missing texture once however many slots use it. Lengths read in the unit that suits them (`formatLength`).

## The view

One `ModelRenderer` per viewer draws on one WebGL canvas, only when something changes (`requestRender`: a gesture, a
mode, a look), never on a loop; disposing it frees the GPU's memory at once (`forceContextLoss`), as stepping through
files makes many viewers. So each renderer gets a canvas of its own (`useModelRenderer` puts it in and takes it out):
a canvas whose context was lost hands that lost context to the next renderer, which three can't start on, as
StrictMode's second mount showed. Where WebGL can't start at all (no usable GPU, the browser's limit of contexts), the
pane says "Couldn't start the 3D view", not the window's error screen. What changes every frame or tick (a playing take's skeleton, the tolerance's colors) is
written into the buffers it has (`writeAttribute`), and a side replaced frees its own (`disposeSide`). The model worker
answers every request, a failure too ("Couldn't compare these surfaces"): no view waits for good. Each version is a scene of its own (`buildModelScene`: its hierarchy, a material per slot, a
wireframe twin sharing the geometry) under one camera (`orbitCamera`), laid out per mode (`layoutOf`):

- **Diffs** (Differences): the version after colored by how far each vertex is from the version before's surface,
  and the version before drawn as a ghost (`--status-deleted`) only where it is gone, over it in its depth. The
  measure (`compareSurfaces`, in the model worker, once per pair) takes each version's surface whole, so a mesh
  renamed or split still compares by shape, and measures each triangle exactly (`surfaceDistances`: closest point on
  a triangle, a bounding volume hierarchy; a uniform grid was tried and dropped, as a dense part beside an empty one
  put thousands of triangles in a cell). A vertex exactly at a vertex of the other version is 0 without a search,
  and each point is measured once (files repeat a corner per polygon): a 2M-triangle car takes 1.4 s unchanged, 5 s
  with every vertex moved. What nothing is near saturates at a tenth of the model ("12 cm+" in the strip). The
  tolerance is a share of the model's size (`modelToleranceShare`, one setting for a bolt and a building), read out
  in mm, cm or m; `heatColors` keeps the clay within it and turns to the accent beyond. ‹ › step through the changed
  regions (`changedRegions`: changed vertices joined through their own triangles and shared corners, patches of
  either version within 3% of the model merged; binning vertices into fixed cells was tried and dropped, as a coarse
  mesh read as 30 regions), each framed and boxed. The strip adds "Moved 12% · up to 4.2 cm" (`movedStat`).
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
  slots can show in their colors (`slotColor`: the avatar fills by name, so a renamed slot changes color) or their
  materials ("Materials" below).
- **Bones** (offered when a version has some, remembered): each version's skeleton over it, a line from each bone
  to its parent bone (`boneLinks`) and a dot per joint, where the bones are now.
- **Takes** (`ModelAnimationBar`, when a version has any): a take picked from both versions' (matched by name,
  `clipChoices`) plays on one timeline, each version its own take of that name at its own length, looping
  (`timeInTake`), so a shorter take ends sooner beside the longer one; a take only one version has says so. It starts
  at the rest pose, and going back to it or leaving puts every node back (`resetPose`). Bones are `Bone`s and skinned
  meshes `SkinnedMesh`es (their twins too, so they deform alike), named as the takes' tracks address them
  (`PropertyBinding.sanitizeNodeName`); the file's inverse bind matrices and bind matrix are carried into the viewer's
  space (`bindSkin`), or the root's units and axes would skin the mesh twice. The bind matrix is the loader's
  (`MeshSkin.bindMatrix`): an FBX binds a mesh where its node is, glTF in the file's space, ignoring the skinned mesh's
  node. Binding a glTF at its node instead drew a Sketchfab export (its meshes under a `Sketchfab_model` root that turns
  Z up and a node that scales centimetres) under them twice: a hundredth of its size, or torn into stray triangles.
  Blendshape animation isn't played: the viewer builds no morph targets, and a take's blendshape track names the
  mesh's node, a Group above the mesh, so three's `AnimationMixer` would log an error for each one it can't bind. Before
  binding, `playableTake` leaves out every track whose node or property the scene hasn't (blendshapes, a node it
  doesn't have), so the bones' tracks beside them still play; the bar then says so in one line (`unplayableWords`:
  "Blendshape animation isn't shown").
- **The scene**: clay lit by a soft studio (three's `RoomEnvironment`) and a key light over the camera's shoulder;
  a ground grid a power of ten apart that suits the model (1 m for a person), X and Z through the origin in Unity's
  axis colors; each version's pivot axes, turned as the node every mesh hangs under. A picked node with no geometry
  (a bone, an empty) shows as a dot on top of everything, framed with a third of the model around it. Colors come from
  `tokens.css` (`readModelPalette`, read again as the theme changes).
- **"What changed"** (`ModelChangesPanel`): folded by default to its title, its count and its risks, so the model has
  the stage, and remembered as the user leaves it (`modelChangesOpen`). Open, beside a pane at least `ROOMY_PANE` wide
  it is a column of its own; narrower, or folded, it floats at the stage's top right (under the onion's pill). A row picked frames and lights up
  its nodes on both sides; the rest fade. **The info strip** (`modelStats`): Tris, Verts, materials, bones,
  blendshapes, animations and size, "before → after" where they changed, both sizes in one unit.

## Beside the model: its `.bin` and its `.meta`

A version is read with what it needs beside it (`useModelReadOptions`), found by a `SiblingFinder`
(`SiblingFinderContext`): a workspace file's sibling is the file beside it, on disk or as loaded (`workspaceSibling`);
a committed diff's (`diffSibling`, provided by `DiffBrowser`) is the entry of the same diff (a glTF's shape lives in
its `.bin`, so a changed shape changed the `.bin` too, with its own revisions; a moved model's `.meta` moved with it, at
its old path on the side before), or, when the diff left it alone, the file where the diff points to (`cs:N`, the
branch's head, `sh:N`, a label's: the same on both sides). Beside a model under an xlink (its repository isn't the workspace's),
that file is read through the tree there, one `cm ls --tree` and its `cm cat`, never a `serverpath:` that can't reach
it (ARCHITECTURE.md "Xlinks"); in a shelve or at a label, whose trees `cm ls` can't list, it isn't found, and the viewer
says what the model needs. A last change in Files or Browse repository (`lastChangeSibling`,
provided by `RevisionChanges`) finds it in the tree's own listings, no `cm` command added: changed in the same
changeset or shelve as the model, its revision and the one before; untouched by it, its one revision on both sides;
changed since, in another repository, or not listed (private, in a folder not opened), none. Elsewhere (history,
merges) none is found. A sibling is found beside the path each side was read from (`sourcePathOf`), never the diff's
file name, which names the next file while the one before still shows. Its name never reaches above the model's
folder, and main refuses a workspace file outside the workspace anyway (`workspaceFileOf`): the renderer is not
trusted.

- **Absent is an answer**: `api.content.readBytes` reads a file that isn't there as null (the disk's `ENOENT`, `cm`'s
  "The item … does not exist": `isMissingItemError`; `cm ls --tree`'s "Can't resolve the selector for the item":
  `isNotInTreeError`), cached as any content, so a model without a `.meta` costs its failing reads once. Any other
  failure rejects, shows Unity's defaults meanwhile and is read again, never kept as "no `.meta`": the server, and a
  changeset, branch or shelve that is gone (`cm` says "does not exist" of those too, which tells nothing of the file).
  `serverpath:`'s "The specified revision was not found" can't tell a missing file from one under an xlink: at a
  changeset or a branch the tree is asked next and its answer decides (two failing commands, once); in a shelve or at
  a label, which have no tree to ask, it is the answer (`isMissingWhereNoTreeIsListed`). It checks a file's size
  before reading it.
- **Read once**: a pending file is read anew on every focus, as new arrays; while its bytes are the same (`sameBytes`),
  the viewer keeps the model it has (`useStableModel`), its read, scene and comparison. Typing into a model written as
  text (or its `.meta`) renders it once typing pauses (`useTypingPause`), not at every keystroke.

- **A glTF's companions** (`gltfCompanions`, from its JSON, decoded as glTF writes URIs) are read as bytes
  (`api.content.readBytes`: an opaque binary has none in `FileContent`), and handed to the loader as `blob:` URLs
  (`noTextureLoading`'s companions); one it can't find still says it needs it (`gltfNeed`). Reads are keyed by the
  model's bytes and the options they were read with (`readModel`).
- **Import settings**: the `.meta` beside the model (`readImportSettings`, over `parseUnityYaml`, the YAML subset Unity
  writes; Unity's defaults without one, or for glTFast's importer): the Scale Factor and Convert Units, scaling the
  model as Unity does (`importScaleOf`, applied in the worker once the file's own units are known:
  `ParsedModel.importScale`, apart from `unitScale`, so a resize names its cause), the Humanoid avatar's bone map,
  the clips cut from the takes by frames (counted at the FBX's frame rate, `TimeMode`; 30 fps without one), and the
  materials remapped onto slots. `importSettingsChanges` tells what the settings do with the model that no longer
  fits it, only when this change broke it: a remap onto a slot it doesn't have, an avatar bone it doesn't have, a clip
  past its take's end or from a take it doesn't have; and a Scale Factor changed. Nothing of them is told when a
  side's `.meta` read failed (`whatChanged`'s `settingsRead`): Unity's defaults stand in for it, and aren't its
  settings. One `cm cat` a side, cached.
- **A model's `.meta` diffed alone** (`modelOfMeta`) shows as the model under each version's settings (`ModelMetaDiff`,
  "Code | Model", the model by default, remembered as `representations.meta`): raising the Scale Factor instead of
  exporting again reads "100× larger in Unity". Only where the model can be found beside it (`modelBesideMeta`);
  elsewhere the `.meta` is its text. A model that didn't change is read once for both sides (`modelReadsOfSides`).

## Materials

The **Materials** look (off by default) shows each material slot with its color and textures as Unity would show them.
With slot colors it is one choice (`SurfaceLook`: clay, slot colors, materials; `clickedSurface`): turning one button on
turns the other off, the one on clicked again goes back to clay, and the choice is remembered across files and sessions
(`modelSurface` in `diffPreferencesStore`, which migrated the old `modelColorBySlot`). The button shows only when some
slot would show more than clay (`materialsOffered`: a remap, a texture, a color or transparency of its own). In Diffs
both buttons stay, off, saying why (`surfaceButtonDisabledReason`: the heatmap colors the model), and the choice comes
back in the other modes. The merge cards' stills stay clay (`modelThumbnail`).

- **From the workspace, never the server.** Materials and textures are read from the workspace on disk as it is now,
  whatever version of the model shows (pending, Files, a changeset, history); only the model's own `.meta` is the
  version's (its remaps, read with its import settings). In a committed diff and in Files each side keeps its own; where
  none was found for the version (`settingsFrom: 'none'`: a last change whose `.meta` changed since, a revision in
  History or a merge, which find no sibling) the workspace's (`takesWorkspaceSettings`, `useWorkspaceImportSettings`),
  as Unity imports it now: an FBX whose materials Unity doesn't make shows clay, never the file's own. A `.meta` whose
  read failed (`'failed'`) shows the defaults until it is read again, never the workspace's look meanwhile; a side
  waiting for the workspace's `.meta` looks nothing up until it is read (`materialsInputOf` is undefined). No `cm`
  command is added (`api.unityAssets.find` reads the disk only; `unityAssetsService.test.ts` checks it can't reach
  `cm`). Reading them from the server was rejected: one `cm cat` per texture per side, on a server many people share,
  for a look whose textures have their own image diff. Without a workspace the look isn't offered. A model under an
  xlink is where the workspace has it too, though its revision is the xlinked repository's: Files' last change and a
  changeset diff name it by its workspace path, the xlink's folder included (`modelWorkspacePath`), and Unity sees
  that folder as part of the project. Only a version without a path shows just what its file holds.
- **Where each slot's material comes from** (`slotSources`, as Unity's ModelImporter decides for FBX and OBJ): with
  Material Creation Mode None (`materialImportMode: 0`, or `importMaterials: 0` in a `.meta` older than Unity 2019.3)
  clay, unless `remapMaterialsIfMaterialImportModeIsNone: 1` (absent, as before 2021.2: clay, as Unity imports it); a
  slot the `.meta` remaps (`externalObjects`, by slot name) takes that `.mat`, and one remapped to a GUID the project
  hasn't is clay (Unity assigns the missing asset, never the file's own), and one remapped to Unity's own
  (Default-Material, by the built-in GUIDs `0000000000000000f000000000000000` and `…e000…`, `isBuiltInGuid`) is Unity's
  default look, looked up nowhere; any other slot the file's material, an OBJ's from its `.mtl` (`readMtlMaterials`,
  read beside it on disk). The legacy external location (`materialLocation: 0`, obsolete since 2019.3) counts as the
  file's own; its `Materials/` folder search isn't done. A glTF's materials are glTFast's: the file's, keyed by
  material, not name (`slotKeysOf`: Sponza's 25 are all unnamed); a map on the second UV set (`texCoord: 1`,
  `TextureUse.channel`) samples it (`uv1`), GLTFLoader's copy of its texture known by the image source it shares; a
  specular-glossiness material (`KHR_materials_pbrSpecularGlossiness`, which three no longer reads) takes its diffuse
  texture and factor as glTFast does (`withSpecularGlossiness`).
- **A `.mat`** (`readUnityMaterial`, over `parseUnityYaml`, which joins values Unity folded onto the next lines): the
  base map is the first set of `_BaseMap` (URP), `_BaseColorMap` (HDRP), `_MainTex` (Built-in), else a Shader Graph
  texture whose name says it is the base color (`_MainTexture`; never one named normal, mask, detail…; a name that says
  nothing, `Texture2D_B222E8F`, is none); the normal map `_BumpMap` or `_NormalMap`; tiling and offset; the color
  `_BaseColor` or `_Color` (sRGB); alpha clip (`_AlphaClip`, `_AlphaCutoffEnable`, Built-in `_Mode` 1, cutoff
  `_Cutoff`/`_AlphaCutoff`), transparency (`_Surface`, `_SurfaceType`, `_Mode` 2 or 3; a `_Mode` left over is ignored
  where `_Surface` or `_SurfaceType` is set), both sides (`_Cull` or `_CullMode` 0, `_DoubleSidedEnable`). Textures by
  GUID; one of Unity's own is there, never missing, and not drawn.
- **Unity's texture search** (`textureCandidates`, `main/unity/textureSearch.ts`), for a texture the file names: a
  `.meta` remap of the texture by its name without extension (by GUID); the model's folder; `Textures/` there and in
  each folder above it up to `Assets` (the project, `unityProjectFound`: the nearest folder above the model whose
  `Assets`, which the model is under, has `ProjectSettings` beside it, as a project may sit in another's `Assets`;
  without one, the outermost folder holding an `Assets` named exactly so, as a vendor's package keeps its own inside the
  project's, else of any case, `unityProjectOf`; outside one, up to the workspace's root); the stored relative path (FBX
  `RelativeFilename`, `..` resolved, kept only inside the project); the stored absolute path, only when it is inside the
  project on this machine (another OS's path is nothing here); then, with "search textures globally", any file of that
  name in `Assets`, nearest first (`preferredMatches`). That setting (`searchTexturesGlobally` under `materials:`) is
  read as written; without it, as the importer that wrote the `.meta` did: below ModelImporter `serializedVersion` 24600
  it always searched, from it it doesn't. Names compare as the disk does (case-insensitive on macOS and Windows);
  nothing outside the workspace is read (`workspaceFileOf`). A glTF's images by URI are files beside it (`siblingPath`),
  on disk.
- **The project's index** (`ProjectAssetIndex`): GUIDs from each `.meta`'s second line, and file names, read outward
  from the model (its folder's subtree, then each folder above it, then `Assets` and the project's `Packages`), a lookup
  stopping at the first ring that answers; what Unity skips (`.hidden`, `Name~`) is left out. A GUID none of them has is
  looked for last in `Library/PackageCache`, where Unity keeps the registry packages it resolved (a URP material a model
  is remapped to), with the same head-only `.meta` reads: only on such a miss, as the cache holds thousands of package
  files, and never the rest of `Library`. A package loaded from a folder outside the project
  (`file:../../Shared/com.studio.art` in `Packages/manifest.json`, `loadsPackagesFromOutside`), which Unity reads where
  it lies, isn't read: in such a project a GUID found nowhere isn't known missing (`outsidePackage`). Without a package
  in `Library/PackageCache` (no `Library`: a project never opened in Unity on this machine; or packages not yet resolved
  there) a GUID missing elsewhere isn't known missing (`pathOfGuid` answers `GuidNotKnown`, `noLibrary`): no risk is
  told, and the look shows clay, as for any material not found. The watcher doesn't see `Library` (`ignore.conf` hides
  it), so the package cache is read again once `Packages` itself changes (Unity rewrites `manifest.json` or
  `packages-lock.json` as it changes the packages it caches); a change anywhere, which drops the rest of the index,
  keeps it, as it says nothing of the cache. As Unity also changes the cache unseen (an upgrade replaces `@17.0.3` with
  `@17.0.4`; the `Library` deleted), a hit there whose `.meta` no longer says so drops the whole cache, and each miss
  over a cache read whole lists its top again (one directory read per miss) and reads it again where its packages differ
  (`packageCacheUnchanged`). The watcher keeps the rest current (`WorkspaceWatchers.listen`: a changed folder is read
  again when next needed, a change anywhere drops it, and so does the watch breaking or stopping; the app's own `cm`
  writes, whose events the watcher drops, count as a change anywhere once they settle, and again when their grace ends,
  `AFTER_OWN_WRITE_GRACE_MS`, as the watcher drops what changed meanwhile as theirs). It is kept only while the watcher
  sees the whole workspace (`coverageOf` is `full`); otherwise a find that starts while no other is under way reads the
  project's folders afresh (finds at once, both versions of a diff, share that read: one starting would overtake the
  other's), and keeps only the package cache (which no watcher sees anyway, and which checks itself:
  `packageCacheUnchanged`). A GUID found is checked against its `.meta` once more. A folder is read once however many
  finds ask at once; once all is read, a miss misses at once. A read that a change overtook keeps nothing, and a find
  after the change never joins it: the listing or GUIDs of a folder forgotten (or of everything cleared) while being
  read are dropped when they arrive, and a whole read the project changed under isn't whole. Only what isn't there is an
  answer: a read the disk refused (a `.meta` Unity or an antivirus holds, too many files open) is kept as nothing and
  read again, and at most 32 files are open at once (`diskProjectFiles`); a GUID is told missing (`pathOfGuid` null)
  only after whole reads no change overtook, of the project and its package cache: when in doubt it says why it can't
  tell (`GuidNotKnown`, with each lookup: finds at once each get their own), as a material told missing that isn't is
  worse than one not told. On macOS folders compare in one Unicode form (the watcher names them decomposed, listings may
  be composed). Changes inside folders `ignore.conf` hides from the watcher aren't seen: an `Assets` folder is versioned
  content. Measured by hand on a project of 100,000 assets (1,000 folders): a GUID it lacks reads it all in about 2.1 s,
  once; the next lookup reads nothing. Tests count the reads (`ProjectAssetIndex.test.ts`).
- **Formats** (`textureFormatOf`), decoded in a worker of their own (`texture.worker`), never on the UI thread (where it
  can't start, textures don't show): PNG, JPEG, GIF, BMP, WebP by the browser (`createImageBitmap`); TGA, TIFF (LZW
  too), EXR (DWAA too) and Radiance HDR by three's loaders (high dynamic range clamped and encoded as sRGB); PSD and PSB
  by the app's own reader of the composite image (`readPsd`: raw or RLE, 8 or 16 bits, RGB or grayscale, alpha; read by
  content, so a PSD named `.psb` reads). Unity imports a `.psb` (a PSD named so too) only in a project with the 2D PSD
  Importer package in `Packages/manifest.json` or `packages-lock.json` (`listsPsdImporter`, `importsPsb`); elsewhere it
  says "this project doesn't import PSB files" and the slot keeps its color. A PSD saved without "Maximize
  Compatibility" (Version Info's `hasRealMergedData`), or in CMYK, Lab, indexed or 32 bits, says so. DDS, KTX and the
  rest aren't shown. A library for PSD (ag-psd) was set aside: layers, effects and text a texture never needs, more of
  an untrusted file parsed; the one thing it would add is flattening the layers of a PSD whose composite is blank.
- **Budget** (`textureBudget`): at most 64 texture files a model (`MAX_TEXTURE_FILES`, both versions together, each file
  once); each drawn at most 2048 px on its longest side, 1024 past 24 textures, with mipmaps; refused before decoding
  past 16384 px a side or 8192² pixels (`imageSizeOf` reads each format's header first), and unread past the read's own
  size cap (100 MB, `MAX_MODEL_BYTES`). A file version decodes once (`textureLoads`: by path, size and time written; the
  latest 384 MB of bitmaps kept), one GPU texture per bitmap and use (`LookTextures`), freed when no look uses it, or
  with the renderer.
- **Drawn** (`SlotLookMaterials`): MeshStandardMaterial, no metal, roughness 0.6, under the same studio; base maps sRGB,
  normal maps linear (a texture's own `.meta` isn't read); an FBX's or OBJ's textured material untinted (Unity's
  ModelImporter drops the diffuse tint), a glTF's tinted by its base color; alpha clip as `alphaTest`, transparency
  blended without depth writes, both sides per material; textures the right way up from the decoder (FBX, OBJ and Unity
  UVs start at the image's bottom). The model shows in its materials' colors (or clay) at once and textures appear as
  they decode: no spinner, no reframing. A picked part lights up and the rest fade, as with clay. Turned off, the look's
  materials and textures stay until the file changes, so turning it on again is immediate.
- **What doesn't show, said once** (`texturesStat`): the info strip's "Textures 9 of 12" (or "Textures 12") while the
  look is on, its tooltip naming the first eight that don't and why (`textureProblemWords`: "not in the workspace",
  "can't read this PSD: save it with Maximize Compatibility"…). No toast, no dialog, nothing over the model.
- **Not shown, and why**: textures embedded in an FBX (Unity uses them only once extracted, as files the search then
  finds); DDS and KTX (GPU formats); the legacy external materials' `Materials/` search; anything but base color,
  normal, alpha and sides (metal, smoothness, emission, detail maps: the look is for seeing the model, not lighting it).

## In a merge

A binary conflict whose versions render (models or images: `rendersVersions`) opens on its versions to keep
(`choice`) and shows each side against the base, and the base, through the diff viewer (docs/features/merge.md). A
model's cards hold a still of it (`modelThumbnail`: drawn once through a renderer of its own, read back at once, let
go) and what its side changed since the base (`ModelSinceBase`, the panel's rows, risks first).

## Sandbox

`scripts/sandboxes/models.sh` builds `models@local` (workspace `/tmp/uvcs-models`): a changeset per case above (a
re-export, wrong units, a turn, a pivot, hierarchy edits, material slots, a sculpt, a polycount, UVs, added and deleted
models), a branch of model changes and a pending one. Then, on /main: a skinned GLB character (`Scout.glb`) whose takes
change (a shorter `Wave`, a new `Jump`), a `.gltf` whose geometry is in the `.bin` beside it (`Barrel.gltf`), import
settings changed in a `.meta` alone (the crate's `globalScale`, the robot's `Wave` clip cut past the end of its take),
and `/main/conflict-lamp`, which conflicts with /main on `Lamp.glb` when merged. Then textured props, one per way Unity
finds materials and textures (`models/texturedModels.ts`: textures beside the model and in a `Textures` folder of its
own or its parent's, a TGA, a `.mat` remap with a PSD base map and a PNG normal map, an alpha-clipped double-sided leaf
card, a glTF's images beside it and a GLB's inside it, a texture missing), all painted in code. Its FBX files are ASCII,
written by `testing/asciiFbx`, which tests use too; its glTF ones are three.js scenes written by GLTFExporter
(`models/gltfModels.ts`, with a `FileReader` stand-in for Node); its `.meta` files are Unity 6.3's
(`models/unityMeta.ts`: ModelImporter for FBX and OBJ, glTFast's ScriptedImporter for glTF and GLB).
