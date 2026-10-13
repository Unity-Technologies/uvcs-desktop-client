// What the Materials look asks the workspace (`api.unityAssets.find`), and what it makes of the answers: each request
// once, the remapped materials' files, and the two rounds of GUIDs (the materials, then their textures) as one
// `FoundAssets` a version is planned with (`planVersion`). Pure: the hooks that ask are `useUnityAssets`.

import { BRANCH_TREE_LIFE_MS, type AssetsPoint, type FoundFile, type UnityAssetsAnswer, type UnityAssetsRequest } from '@shared/domain/unityAssets';
import { lookupKey, materialTextureGuids, type FoundAssets } from './materialPlan';
import type { UnityMaterial } from './unityMaterial';

/** The requests once each, and where each of the given ones is among them (-1 for none). */
export function uniqueRequests(requests: readonly (UnityAssetsRequest | null)[]): { requests: UnityAssetsRequest[]; indices: number[] } {
  const keys: string[] = [];
  const unique: UnityAssetsRequest[] = [];
  const indices = requests.map((request) => {
    if (!request) return -1;
    const key = JSON.stringify(request);
    if (!keys.includes(key)) {
      keys.push(key);
      unique.push(request);
    }
    return keys.indexOf(key);
  });
  return { requests: unique, indices };
}

/**
 * How long a find's answer holds: the disk changes under us, as a workspace file's content does; a changeset's tree
 * never changes; a branch's head moves as people check in (`BRANCH_TREE_LIFE_MS`, as main keeps its tree). An answer
 * that couldn't be read whole (`unread`: the server down for a listing) holds not at all, so the next look asks again.
 */
export function findStaleTime(point: AssetsPoint, answer: UnityAssetsAnswer | undefined): number {
  if (point.kind === 'workspace' || answer?.guidMisses === 'unread') return 0;
  return point.at.startsWith('cs:') ? Number.POSITIVE_INFINITY : BRANCH_TREE_LIFE_MS;
}

/** Files once each, by what tells one apart (`keyOf`: a found file's version, a source's place). */
export function uniqueFiles<T>(files: readonly T[], keyOf: (file: T) => string): T[] {
  return [...new Map(files.map((file) => [keyOf(file), file])).values()];
}

/** Each side's remapped materials, by GUID, with the file found for each (null while unanswered or not found). */
export function materialFiles(answers: readonly (UnityAssetsAnswer | null | undefined)[], requests: readonly (UnityAssetsRequest | null)[]): { guid: string; file: FoundFile | null }[][] {
  return requests.map((request, i) => (request ? request.guids.map((guid, g) => ({ guid, file: answers[i]?.guids[g] ?? null })) : []));
}

/** The second round: the textures the side's `.mat` files use, by GUID; null when they use none. */
export function textureRequestOf(request: UnityAssetsRequest | null, materials: ReadonlyMap<string, UnityMaterial | null> | undefined): UnityAssetsRequest | null {
  const guids = request && materials ? materialTextureGuids(materials.values()) : [];
  return request && guids.length > 0 ? { ...request, textures: [], paths: [], guids } : null;
}

/** Both rounds' answers as what a version is planned with: each lookup's file, by its key. */
export function foundAssets(
  first: UnityAssetsRequest,
  answer: UnityAssetsAnswer | null,
  second: UnityAssetsRequest | null,
  secondAnswer: UnityAssetsAnswer | null,
  materials: Map<string, UnityMaterial | null>,
): FoundAssets {
  const pair = <T, K>(keys: K[], values: (T | null)[] | undefined) => new Map(keys.map((key, i) => [key, values?.[i] ?? null]));
  const guids = new Map<string, FoundFile | null>([...pair(first.guids, answer?.guids), ...(second ? pair(second.guids, secondAnswer?.guids) : [])]);
  return {
    textures: pair(first.textures.map((lookup) => lookupKey({ kind: 'named', name: lookup.name, storedPaths: lookup.storedPaths })), answer?.textures),
    paths: pair(first.paths, answer?.paths),
    guids,
    materials,
    importsPsb: answer?.importsPsb ?? false,
  };
}

/** Nothing found: a version with no place in the workspace shows only what its file holds. */
export function nothingFound(): FoundAssets {
  return { textures: new Map(), paths: new Map(), guids: new Map(), materials: new Map(), importsPsb: false };
}
