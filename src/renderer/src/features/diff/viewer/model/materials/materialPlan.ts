// From each slot's source (`slotSources`) to what the renderer draws, in steps between which the workspace is read:
//   1. `assetsRequest`: what to look up for a version (`api.unityAssets.find`): its remapped materials by GUID, the
//      textures its file materials name (Unity's texture search, a texture remapped by name first), a glTF's images
//      beside it by path;
//   2. the `.mat` files found are read (`readUnityMaterial`), and their textures looked up by GUID (`materialTextureGuids`);
//   3. `planVersion`: each slot's color, alpha and maps, and the texture files to decode (`TextureNeed`), or why one
//      can't show (`TextureProblem`);
//   4. `budgeted`: both versions' textures within the budget, the same file once;
//   5. `slotLooks`: each slot as drawn now, with the textures decoded so far; `texturesReport` for the info strip.
// Materials and textures are always the workspace's, whichever version of the model shows (docs/features/model-diff.md).

import type { FoundFile, TextureLookup, UnityAssetsRequest } from '@shared/domain/unityAssets';
import { Color, SRGBColorSpace } from 'three';
import { siblingPath } from '../modelSiblings';
import type { AlphaMode, FileMaterial, FileTexture, TextureUse } from '../parsedModel';
import { MAX_TEXTURE_FILES, textureSideFor } from '../textures/textureBudget';
import { textureFormatOf } from '../textures/textureFormats';
import type { TextureProblem } from '../textures/textureProblems';
import type { ModelMaterialsInput, SlotSource } from './slotSources';
import type { UnityMaterial } from './unityMaterial';

/** What the workspace answered for a version: each lookup's file, and each `.mat` found as read. */
export interface FoundAssets {
  /** By `lookupKey`. */
  textures: Map<string, FoundFile | null>;
  /** By the path asked (a glTF's images beside it). */
  paths: Map<string, FoundFile | null>;
  /** By GUID: remapped materials, and their textures. */
  guids: Map<string, FoundFile | null>;
  /** By the material's GUID; null when it doesn't read as one. */
  materials: Map<string, UnityMaterial | null>;
  /** Whether the project imports `.psb` textures (`UnityAssetsAnswer.importsPsb`). */
  importsPsb: boolean;
}

/** A texture file to decode: one per file and orientation, whichever slots and versions use it. */
export interface TextureNeed {
  id: string;
  name: string;
  /** A workspace file, or an image a version's glTF holds. */
  where: { kind: 'file'; file: FoundFile } | { kind: 'gltfImage'; side: Side; image: number };
  /** UVs from the image's bottom (all but glTF). */
  flipY: boolean;
}

export interface PlannedMap {
  need: string;
  repeat: [number, number];
  offset: [number, number];
  rotation: number;
  /** The UV set the map samples (`TextureUse.channel`). */
  channel: number;
}

/** A slot as planned: its look without textures, and the maps to add as they decode. */
export interface PlannedSlot {
  /** Linear RGB, while no base map shows. */
  color: [number, number, number];
  /** Linear RGB once the base map shows: white for a file's material in Unity's ModelImporter (it drops the tint). */
  colorWithMap: [number, number, number];
  opacity: number;
  alpha: AlphaMode;
  cutoff: number;
  doubleSided: boolean;
  baseMap: PlannedMap | null;
  normalMap: PlannedMap | null;
}

/** A texture that doesn't show, by its file name. */
export interface TextureIssue {
  name: string;
  problem: TextureProblem;
}

/** Where a slot's material resolved to, by name: what the "What changed" panel compares (`materialChanges`). */
export type ResolvedMaterial =
  /** Unity's default material. */
  | { kind: 'default' }
  /** Remapped to a material the project hasn't: Unity shows its missing material. */
  | { kind: 'missing' }
  /** A `.mat` of the project: known by its GUID, named by its file name (and its path where names alike meet). */
  | { kind: 'project'; guid: string; name: string; path: string }
  /** The material the model file defines (an OBJ's `.mtl`'s). */
  | { kind: 'file'; name: string };

/** A texture a slot's material uses, found or not. */
export interface SlotTexture {
  /** The same for the same texture on both sides: its path when found, else its GUID or name. */
  id: string;
  /** Its file name; a `.mat`'s texture the workspace hasn't, by what it is to the slot ("Glass's base map"). */
  name: string;
  /** Not in the workspace. */
  missing: boolean;
  repeat: [number, number];
  offset: [number, number];
}

/** A slot by name, with its material and the textures that material uses. */
export interface ResolvedSlot {
  slot: string;
  material: ResolvedMaterial;
  baseMap: SlotTexture | null;
  normalMap: SlotTexture | null;
}

export interface VersionPlan {
  /** Null for a slot drawn in clay (Unity's default material). */
  slots: Map<string, PlannedSlot | null>;
  /** By the same keys. */
  resolved: Map<string, ResolvedSlot>;
  needs: TextureNeed[];
  issues: TextureIssue[];
}

/** Step 1. */
export function assetsRequest(version: ModelMaterialsInput, sources: Map<string, SlotSource>, modelPath: string): UnityAssetsRequest {
  const textures = new Map<string, TextureLookup>();
  const paths = new Set<string>();
  const guids = new Set<string>();
  for (const source of sources.values()) {
    if (source.kind === 'remapped') guids.add(source.guid);
    const material = source.kind === 'file' ? source.material : null;
    for (const use of [material?.baseMap, material?.normalMap]) {
      const texture = use?.texture;
      if (texture?.kind === 'named') textures.set(lookupKey(texture), lookupOf(texture, version));
      if (texture?.kind === 'beside') {
        const path = siblingPath(modelPath, texture.path);
        if (path !== null) paths.add(path);
      }
    }
  }
  return { modelPath, textures: [...textures.values()], guids: [...guids], paths: [...paths], searchTexturesGlobally: version.settings.searchTexturesGlobally };
}

/** Step 2: the textures the `.mat` files read use, to look up by GUID. */
export function materialTextureGuids(materials: Iterable<UnityMaterial | null>): string[] {
  const guids = new Set<string>();
  for (const material of materials) for (const map of [material?.baseMap, material?.normalMap]) if (map) guids.add(map.guid);
  return [...guids];
}

/** The key a named texture's lookup answers by. */
export function lookupKey(texture: Extract<FileTexture, { kind: 'named' }>): string {
  return [texture.name, ...texture.storedPaths].join('\0');
}

function lookupOf(texture: Extract<FileTexture, { kind: 'named' }>, version: ModelMaterialsInput): TextureLookup {
  const bare = texture.name.replace(/\.[^.]*$/, '');
  const remap = version.settings.textureRemaps.find((candidate) => candidate.name === bare);
  return { name: texture.name, storedPaths: texture.storedPaths, remapGuid: remap?.guid ?? null };
}

/** Which version of the model. */
export type Side = 'before' | 'after';

/** Step 3. `side` keeps a glTF's own images apart from the other version's. */
export function planVersion(version: ModelMaterialsInput, sources: Map<string, SlotSource>, found: FoundAssets, modelPath: string, side: Side): VersionPlan {
  const needs = new Map<string, TextureNeed>();
  const issues = new Map<string, TextureIssue>();
  const gltf = version.format === 'gltf' || version.format === 'glb';
  const flipY = !gltf;

  const fileMap = (file: FoundFile | null | undefined, name: string, transform: Omit<PlannedMap, 'need'>): PlannedMap | null => {
    if (!file) {
      issues.set(name, { name, problem: 'missing' });
      return null;
    }
    const fileName = fileNameOf(file.path);
    if (textureFormatOf(fileName) === 'unsupported') {
      issues.set(fileName, { name: fileName, problem: 'unsupportedFormat' });
      return null;
    }
    // Unity imports a `.psb` only with the 2D PSD Importer: without it the material has no texture there.
    if (/\.psb$/i.test(fileName) && !found.importsPsb) {
      issues.set(fileName, { name: fileName, problem: 'psbNotImported' });
      return null;
    }
    const id = `${flipY ? 'up' : 'down'}:${file.path}`;
    needs.set(id, { id, name: fileName, where: { kind: 'file', file }, flipY });
    return { need: id, ...transform };
  };

  const useMap = (use: TextureUse | null): PlannedMap | null => {
    if (!use) return null;
    const transform = { repeat: use.repeat, offset: use.offset, rotation: use.rotation, channel: use.channel };
    const { texture } = use;
    if (texture.kind === 'gltfImage') {
      const id = `${side}:image:${texture.image}`;
      needs.set(id, { id, name: imageName(texture.image), where: { kind: 'gltfImage', side, image: texture.image }, flipY: false });
      return { need: id, ...transform };
    }
    const located = locateFileTexture(texture, found, modelPath);
    return fileMap(located.file, located.name, transform);
  };

  const fromFile = (material: FileMaterial): PlannedSlot => ({
    color: material.color,
    // glTFast multiplies the base map by the base color; Unity's ModelImporter shows a textured material untinted.
    colorWithMap: gltf ? material.color : [1, 1, 1],
    opacity: material.opacity,
    alpha: material.alpha,
    cutoff: material.cutoff,
    doubleSided: material.doubleSided,
    baseMap: useMap(material.baseMap),
    normalMap: useMap(material.normalMap),
  });

  // A material's texture that isn't found is known by its GUID only: named by what it is to the slot.
  const fromUnity = (material: UnityMaterial, slot: string): PlannedSlot => {
    const color = linearOf(material.baseColor);
    const map = (texture: UnityMaterial['baseMap'], role: string): PlannedMap | null =>
      texture && fileMap(found.guids.get(texture.guid), `${slot}'s ${role}`, { repeat: texture.scale, offset: texture.offset, rotation: 0, channel: 0 });
    return {
      color,
      colorWithMap: color,
      opacity: material.alpha === 'blend' ? material.baseColor[3] : 1,
      alpha: material.alpha,
      cutoff: material.cutoff,
      doubleSided: material.doubleSided,
      baseMap: map(material.baseMap, 'base map'),
      normalMap: map(material.normalMap, 'normal map'),
    };
  };

  const slotOf = (slot: string, source: SlotSource): PlannedSlot | null => {
    if (source.kind === 'default') return null;
    if (source.kind === 'file') return fromFile(source.material);
    const material = found.materials.get(source.guid);
    return material ? fromUnity(material, slot) : null;
  };

  const slots = new Map([...sources].map(([slot, source]) => [slot, slotOf(slot, source)]));
  const names = new Map(version.slots.map(({ key, name }) => [key, name]));
  const resolved = new Map([...sources].map(([slot, source]) => [slot, resolvedSlot(names.get(slot) ?? slot, slot, source, found, modelPath)]));
  return { slots, resolved, needs: [...needs.values()], issues: [...issues.values()] };
}

/** A file's material's texture in the workspace: its file, null when not found; and what names it meanwhile. */
function locateFileTexture(texture: Exclude<FileTexture, { kind: 'gltfImage' }>, found: FoundAssets, modelPath: string): { file: FoundFile | null; id: string; name: string } {
  if (texture.kind === 'named') return { file: found.textures.get(lookupKey(texture)) ?? null, id: lookupKey(texture), name: texture.name };
  const path = siblingPath(modelPath, texture.path);
  return { file: (path !== null && found.paths.get(path)) || null, id: texture.path, name: texture.path.split('/').pop()! };
}

/** What a slot (`key`, named `slot`) resolved to: its material by name, and the textures it uses. */
function resolvedSlot(slot: string, key: string, source: SlotSource, found: FoundAssets, modelPath: string): ResolvedSlot {
  const located = (at: { file: FoundFile | null; id: string; name: string }, repeat: [number, number], offset: [number, number]): SlotTexture => ({
    id: at.file?.path ?? at.id,
    name: at.file ? fileNameOf(at.file.path) : at.name,
    missing: !at.file,
    repeat,
    offset,
  });
  const fileTexture = (use: TextureUse | null): SlotTexture | null => {
    if (!use) return null;
    const { texture } = use;
    if (texture.kind === 'gltfImage') return { id: `image:${texture.image}`, name: imageName(texture.image), missing: false, repeat: use.repeat, offset: use.offset };
    return located(locateFileTexture(texture, found, modelPath), use.repeat, use.offset);
  };
  const unityTexture = (texture: UnityMaterial['baseMap'], role: string): SlotTexture | null =>
    texture && located({ file: found.guids.get(texture.guid) ?? null, id: texture.guid, name: `${key}'s ${role}` }, texture.scale, texture.offset);

  if (source.kind === 'default') return { slot, material: { kind: 'default' }, baseMap: null, normalMap: null };
  if (source.kind === 'file') return { slot, material: { kind: 'file', name: source.material.name }, baseMap: fileTexture(source.material.baseMap), normalMap: fileTexture(source.material.normalMap) };
  const file = found.guids.get(source.guid);
  if (!file) return { slot, material: { kind: 'missing' }, baseMap: null, normalMap: null };
  const material = found.materials.get(source.guid) ?? null;
  return {
    slot,
    material: { kind: 'project', guid: source.guid, name: fileNameOf(file.path).replace(/\.mat$/i, ''), path: file.path },
    baseMap: unityTexture(material?.baseMap ?? null, 'base map'),
    normalMap: unityTexture(material?.normalMap ?? null, 'normal map'),
  };
}

function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** A glTF's image the file holds, by its place in it. */
function imageName(image: number): string {
  return `image ${image + 1}`;
}

/** Step 4: the textures both versions need, each once, the first `MAX_TEXTURE_FILES` decoded at the budget's side. */
export function budgeted(plans: readonly (VersionPlan | null)[]): { needs: TextureNeed[]; over: TextureNeed[]; longest: number } {
  const all = new Map<string, TextureNeed>();
  for (const plan of plans) for (const need of plan?.needs ?? []) all.set(need.id, need);
  const needs = [...all.values()];
  return { needs: needs.slice(0, MAX_TEXTURE_FILES), over: needs.slice(MAX_TEXTURE_FILES), longest: textureSideFor(Math.min(needs.length, MAX_TEXTURE_FILES)) };
}

/** A texture's state as it loads: its bitmap once decoded, why not if it failed. */
export type NeedState = { kind: 'loading' } | { kind: 'ready'; key: string; bitmap: ImageBitmap } | { kind: 'failed'; problem: TextureProblem };

export interface MapLook {
  /** The decoded texture's key: one GPU texture per key. */
  key: string;
  bitmap: ImageBitmap;
  repeat: [number, number];
  offset: [number, number];
  rotation: number;
  /** The UV set the map samples (`TextureUse.channel`). */
  channel: number;
}

/** A slot as drawn. */
export interface SlotLook {
  color: [number, number, number];
  opacity: number;
  alpha: AlphaMode;
  cutoff: number;
  doubleSided: boolean;
  baseMap: MapLook | null;
  normalMap: MapLook | null;
}

/** Step 5: each slot with the textures decoded so far; a slot in clay is absent. */
export function slotLooks(plan: VersionPlan, states: ReadonlyMap<string, NeedState>): Map<string, SlotLook> {
  const looks = new Map<string, SlotLook>();
  const mapOf = (planned: PlannedMap | null): MapLook | null => {
    const state = planned && states.get(planned.need);
    return planned && state?.kind === 'ready' ? { key: state.key, bitmap: state.bitmap, repeat: planned.repeat, offset: planned.offset, rotation: planned.rotation, channel: planned.channel } : null;
  };
  for (const [slot, planned] of plan.slots) {
    if (!planned) continue;
    const baseMap = mapOf(planned.baseMap);
    looks.set(slot, {
      color: baseMap ? planned.colorWithMap : planned.color,
      opacity: planned.opacity,
      alpha: planned.alpha,
      cutoff: planned.cutoff,
      doubleSided: planned.doubleSided,
      baseMap,
      normalMap: mapOf(planned.normalMap),
    });
  }
  return looks;
}

export interface TexturesReport {
  /** Every texture the versions' materials use, each file once. */
  total: number;
  shown: number;
  loading: number;
  issues: TextureIssue[];
}

export function texturesReport(plans: readonly (VersionPlan | null)[], states: ReadonlyMap<string, NeedState>, over: readonly TextureNeed[]): TexturesReport {
  const issues = new Map<string, TextureIssue>();
  for (const plan of plans) for (const issue of plan?.issues ?? []) issues.set(issue.name, issue);
  const needs = new Map<string, TextureNeed>();
  for (const plan of plans) for (const need of plan?.needs ?? []) needs.set(need.id, need);
  const overIds = new Set(over.map((need) => need.id));
  let shown = 0;
  let loading = 0;
  for (const need of needs.values()) {
    const state = states.get(need.id);
    if (state?.kind === 'ready') shown++;
    else if (state?.kind === 'failed') issues.set(need.name, { name: need.name, problem: state.problem });
    else if (!overIds.has(need.id)) loading++;
  }
  for (const need of over) issues.set(need.name, { name: need.name, problem: 'overBudget' });
  const unplanned = [...issues.values()].filter(({ problem }) => problem === 'missing' || problem === 'unsupportedFormat' || problem === 'psbNotImported');
  return { total: needs.size + unplanned.length, shown, loading, issues: [...issues.values()] };
}

/** A Unity material's color (sRGB, as kept) in three's linear working space. */
function linearOf([r, g, b]: [number, number, number, number]): [number, number, number] {
  const color = new Color().setRGB(r, g, b, SRGBColorSpace);
  return [color.r, color.g, color.b];
}
