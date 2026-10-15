// What changed in each slot's material between two versions of a model, as Unity resolves it (docs/features/
// model-diff.md, "What changed"): where the slot takes its material from (Unity's default, a project's `.mat`, the
// file's own, a remap to a material the project hasn't), and, for the same material on both sides, what a person sees
// change (base map, base color, normal map, alpha, sides, tiling). Compared from both versions' plans (`planVersion`),
// each read where its version is (its `AssetsPoint`): a `.mat` the diff changed reads as it was on one side and as it
// is on the other. Words are `materialChangeWords`'.

import type { AssetsPoint, UnityAssetsRequest } from '@shared/domain/unityAssets';
import { Color, LinearSRGBColorSpace } from 'three';
import type { AlphaMode } from '../parsedModel';
import type { PlannedSlot, ResolvedMaterial, ResolvedSlot, SlotTexture, VersionPlan } from './materialPlan';
import { isPlaceKey } from './slotKeys';
import type { SlotSource } from './slotSources';

/** A map's tiling and offset, as the material's Inspector shows them. */
export interface Tiling {
  repeat: [number, number];
  offset: [number, number];
}

export type MaterialChange =
  | { kind: 'source'; slot: string; before: ResolvedMaterial; after: ResolvedMaterial }
  /** Texture names; null for none. */
  | { kind: 'baseMap'; slot: string; before: string | null; after: string | null }
  | { kind: 'normalMap'; slot: string; before: string | null; after: string | null }
  /** As the Inspector shows it: `#RRGGBB`, in sRGB. */
  | { kind: 'baseColor'; slot: string; before: string; after: string }
  | { kind: 'alpha'; slot: string; before: AlphaMode; after: AlphaMode }
  | { kind: 'cutoff'; slot: string; before: number; after: number }
  | { kind: 'doubleSided'; slot: string; now: boolean }
  /** A transparent material's alpha, 0 to 1, told in whole percents. */
  | { kind: 'opacity'; slot: string; before: number; after: number }
  | { kind: 'tiling'; slot: string; before: Tiling; after: Tiling }
  /** A texture the slot's material now uses that the workspace hasn't. */
  | { kind: 'textureMissing'; slot: string; texture: string };

/** What loses work or shows wrong in every scene: a slot showing Unity's missing material, a texture not there. */
export function isMaterialRisk(change: MaterialChange): boolean {
  return (change.kind === 'source' && change.after.kind === 'missing') || change.kind === 'textureMissing';
}

/** Each slot both versions have, in the version after's order. */
export function materialChanges(before: VersionPlan, after: VersionPlan): MaterialChange[] {
  const changes: MaterialChange[] = [];
  for (const [keyBefore, keyAfter] of pairedSlots(before.resolved, after.resolved)) {
    const was = before.resolved.get(keyBefore)!;
    const now = after.resolved.get(keyAfter)!;
    if (sameMaterial(was.material, now.material)) changes.push(...lookChanges(was, now, before.slots.get(keyBefore) ?? null, after.slots.get(keyAfter) ?? null));
    else changes.push({ kind: 'source', slot: now.slot, before: was.material, after: now.material });
    changes.push(...newlyMissing(was, now));
  }
  return changes;
}

/**
 * The slots both versions have, as [key before, key after], in the version after's order: by key where it is the
 * slot's name; a glTF's materials, keyed by their place in the file, by their name where both files name one material
 * so (a material added first moves every other), and none that is unnamed or shares its name, as nothing tells them apart.
 */
function pairedSlots(before: ReadonlyMap<string, ResolvedSlot>, after: ReadonlyMap<string, ResolvedSlot>): [string, string][] {
  const byUniqueName = (slots: ReadonlyMap<string, ResolvedSlot>): Map<string, string> => {
    const keys = new Map<string, string | null>();
    for (const [key, { slot }] of slots) if (isPlaceKey(key) && slot !== '') keys.set(slot, keys.has(slot) ? null : key);
    return new Map([...keys].flatMap(([slot, key]) => (key === null ? [] : [[slot, key]])));
  };
  const namedBefore = byUniqueName(before);
  const namedAfter = byUniqueName(after);
  return [...after].flatMap(([key, { slot }]): [string, string][] => {
    if (!isPlaceKey(key)) return before.has(key) ? [[key, key]] : [];
    const was = namedAfter.get(slot) === key ? namedBefore.get(slot) : undefined;
    return was ? [[was, key]] : [];
  });
}

/** A version as the comparison would read it: its slots' sources, and what it would ask the workspace. */
export interface MaterialSide {
  sources: Map<string, SlotSource>;
  request: UnityAssetsRequest | null;
}

/**
 * Whether two versions' materials may resolve differently, so they're worth reading to list their changes, with the
 * look off too: versions whose slots take other sources or ask other lookups; or ask the same at two points of one
 * diff that changed a file such lookups read (a `.mat`, a texture, either's `.meta`, the model's: `changesMaterialAssets`). The two sides
 * of a committed diff are always at two points: comparing the points themselves would list the model's folder for
 * every model diff opened, the look off, to tell nothing. A history's or a last change's two points, whose changes
 * aren't known, are compared with the look on only.
 */
export function materialsMayDiffer(before: MaterialSide, after: MaterialSide): boolean {
  const keyOf = ({ sources, request }: MaterialSide): string => JSON.stringify([[...sources].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), request && { ...request, point: null }]);
  return keyOf(before) !== keyOf(after) || changesMaterialAssets(before.request) || changesMaterialAssets(after.request);
}

/**
 * Whether a diff's side before undoes a change to a file a material lookup reads: a `.mat`, an image, an `.mtl`, the
 * `.meta` of one of those (its GUID), or the model's own `.meta` (its remaps). A script's `.meta` names nothing a
 * material reads.
 */
function changesMaterialAssets(request: UnityAssetsRequest | null | undefined): boolean {
  const point: AssetsPoint | undefined = request?.point;
  if (point?.kind !== 'repository' || point.before?.kind !== 'changes') return false;
  return point.before.changes.some((change) => MATERIAL_ASSET.test(change.path) || change.path === `${request!.modelPath}.meta`);
}

const MATERIAL_ASSET = /\.(?:mat|mtl|png|jpe?g|gif|bmp|webp|tga|tiff?|exr|hdr|psd|psb|dds|ktx2?)(?:\.meta)?$/i;

/** A slot's own material is the same on both sides, whatever the file calls it: what changed in it is its look. */
function sameMaterial(before: ResolvedMaterial, after: ResolvedMaterial): boolean {
  if (before.kind !== after.kind) return false;
  return before.kind !== 'project' || before.guid === (after as typeof before).guid;
}

function lookChanges(was: ResolvedSlot, now: ResolvedSlot, before: PlannedSlot | null, after: PlannedSlot | null): MaterialChange[] {
  const slot = now.slot;
  const changes: MaterialChange[] = [];
  if (was.baseMap?.id !== now.baseMap?.id) changes.push({ kind: 'baseMap', slot, before: nameOf(was.baseMap), after: nameOf(now.baseMap) });
  else if (was.baseMap && now.baseMap && !sameTiling(was.baseMap, now.baseMap)) changes.push({ kind: 'tiling', slot, before: tilingOf(was.baseMap), after: tilingOf(now.baseMap) });
  if (was.normalMap?.id !== now.normalMap?.id) changes.push({ kind: 'normalMap', slot, before: nameOf(was.normalMap), after: nameOf(now.normalMap) });
  if (!before || !after) return changes;
  const [colorBefore, colorAfter] = [hexOf(shownColor(before)), hexOf(shownColor(after))];
  if (colorBefore !== colorAfter) changes.push({ kind: 'baseColor', slot, before: colorBefore, after: colorAfter });
  if (before.alpha !== after.alpha) changes.push({ kind: 'alpha', slot, before: before.alpha, after: after.alpha });
  else if (before.alpha === 'clip' && before.cutoff !== after.cutoff) changes.push({ kind: 'cutoff', slot, before: before.cutoff, after: after.cutoff });
  else if (before.alpha === 'blend' && percentOf(before.opacity) !== percentOf(after.opacity)) changes.push({ kind: 'opacity', slot, before: before.opacity, after: after.opacity });
  if (before.doubleSided !== after.doubleSided) changes.push({ kind: 'doubleSided', slot, now: after.doubleSided });
  return changes;
}

/** The textures the slot's material uses now that the workspace hasn't, and which it didn't use before. */
function newlyMissing(was: ResolvedSlot, now: ResolvedSlot): MaterialChange[] {
  const missingBefore = new Set([was.baseMap, was.normalMap].flatMap((texture) => (texture?.missing ? [texture.id] : [])));
  return [now.baseMap, now.normalMap].flatMap((texture) => (texture?.missing && !missingBefore.has(texture.id) ? [{ kind: 'textureMissing' as const, slot: now.slot, texture: texture.name }] : []));
}

function nameOf(texture: SlotTexture | null): string | null {
  return texture?.name ?? null;
}

function tilingOf({ repeat, offset }: SlotTexture): Tiling {
  return { repeat, offset };
}

function sameTiling(a: SlotTexture, b: SlotTexture): boolean {
  return [...a.repeat, ...a.offset].every((value, i) => value === [...b.repeat, ...b.offset][i]);
}

/** The color the slot shows: a file's material under its base map is drawn untinted (`colorWithMap`). */
function shownColor(slot: PlannedSlot): [number, number, number] {
  return slot.baseMap ? slot.colorWithMap : slot.color;
}

/** An alpha as it is told, in whole percents: what reads alike is no change. */
export function percentOf(value: number): number {
  return Math.round(value * 100);
}

/** A linear color as the Inspector shows it: in sRGB, 8 bits a channel, so what rounds alike is no change. */
export function hexOf([r, g, b]: [number, number, number]): string {
  return `#${new Color().setRGB(r, g, b, LinearSRGBColorSpace).getHexString().toUpperCase()}`;
}
