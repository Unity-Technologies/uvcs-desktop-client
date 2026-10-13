import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import type { FoundFile, UnityAssetsAnswer, UnityAssetsRequest } from '@shared/domain/unityAssets';
import { api } from '../../../../../api/client';
import { queryKeys } from '../../../../../api/queryKeys';
import { contentCaching } from '../../useDiffContents';
import { gltfImageBytes } from '../gltfJson';
import { siblingPath } from '../modelSiblings';
import type { ParsedModel } from '../parsedModel';
import type { ModelReadOptions } from '../readModelFile';
import { loadTexture, textureKey, type TextureLoad } from '../textures/textureLoads';
import {
  assetsRequest,
  budgeted,
  lookupKey,
  materialTextureGuids,
  planVersion,
  slotLooks,
  texturesReport,
  type FoundAssets,
  type NeedState,
  type SlotLook,
  type TexturesReport,
  type VersionPlan,
} from './materialPlan';
import { objMaterialLibraries, readMtlMaterials } from './mtlMaterials';
import { slotKeysOf } from './slotKeys';
import { materialsOffered, slotSources, type MaterialSlot, type ModelMaterialsInput } from './slotSources';
import { readUnityMaterial, type UnityMaterial } from './unityMaterial';

/** A version of the model as read, and where it is in the workspace (null when it names no path there). */
export interface MaterialVersion {
  model: ParsedModel;
  bytes: ModelBytes;
  options: ModelReadOptions;
  path: string | null;
}

export interface ModelMaterials {
  /** Whether the look shows anything the clay doesn't (`materialsOffered`). */
  offered: boolean;
  /** Each side's slots as drawn now; null until the look was first turned on for these versions. */
  looks: Record<'before' | 'after', ReadonlyMap<string, SlotLook> | null>;
  report: TexturesReport | null;
}

const SIDES = ['before', 'after'] as const;

type WorkspaceFileSource = Extract<ContentSource, { kind: 'workspaceFile' }>;
const NO_LOOKS = { before: null, after: null };

/**
 * The Materials look for a model's versions (docs/features/model-diff.md, "Materials"): whether it's offered, and,
 * once `wanted`, each slot's material and textures as Unity would show them, read from the workspace on disk (never
 * the server: no `cm` command), textures appearing as they decode. Turned off, what was read and decoded stays until
 * the versions change, so turning it on again is immediate.
 */
export function useModelMaterials(workspacePath: string, versions: Record<'before' | 'after', MaterialVersion | null>, wanted: boolean): ModelMaterials {
  const mtl = useMtlMaterials(workspacePath, versions);
  const inputs = useMemo(
    () => ({ before: inputOf(versions.before, mtl.before), after: inputOf(versions.after, mtl.after) }),
    [versions.before, versions.after, mtl.before, mtl.after],
  );
  const offered = workspacePath !== '' && materialsOffered([inputs.before, inputs.after]);
  const active = useLatch(wanted && offered, inputs);

  const sources = useMemo(() => ({ before: inputs.before && slotSources(inputs.before), after: inputs.after && slotSources(inputs.after) }), [inputs]);
  const requests = useMemo(
    () => SIDES.map((side) => (active && inputs[side] && sources[side] && versions[side]?.path ? assetsRequest(inputs[side]!, sources[side]!, versions[side]!.path!) : null)),
    [active, inputs, sources, versions],
  );
  const firstAnswers = useAssets(workspacePath, requests);
  const materials = useUnityMaterials(workspacePath, firstAnswers, requests);
  const secondRequests = useMemo(
    () =>
      requests.map((request, i) => {
        const guids = request && materials[i] ? materialTextureGuids(materials[i]!.values()) : [];
        return request && guids.length > 0 ? { ...request, textures: [], paths: [], guids } : null;
      }),
    [requests, materials],
  );
  const secondAnswers = useAssets(workspacePath, secondRequests);

  const plans = useMemo((): (VersionPlan | null)[] => {
    if (!active) return [null, null];
    return SIDES.map((side, i) => {
      const input = inputs[side];
      const version = versions[side];
      const request = requests[i];
      if (!input || !version || !sources[side]) return null;
      // Without a path in the workspace, only what the file holds (a glTF's own images) can show.
      if (!request) return planVersion(input, sources[side]!, emptyFound(), version.path ?? '', side);
      const first = firstAnswers[i];
      if (first === undefined || (secondRequests[i] && secondAnswers[i] === undefined) || materials[i] === undefined) return null;
      return planVersion(input, sources[side]!, foundAssets(request, first, secondRequests[i] ?? null, secondAnswers[i] ?? null, materials[i]!), request.modelPath, side);
    });
  }, [active, inputs, versions, sources, requests, firstAnswers, secondRequests, secondAnswers, materials]);

  const budget = useMemo(() => budgeted(plans), [plans]);
  const loads = useMemo(() => textureLoads(workspacePath, budget, versions), [workspacePath, budget, versions]);
  const states = useTextureStates(workspacePath, loads);

  return useMemo((): ModelMaterials => {
    if (!active) return { offered, looks: NO_LOOKS, report: null };
    const [before, after] = plans;
    return {
      offered,
      looks: { before: before ? slotLooks(before, states) : null, after: after ? slotLooks(after, states) : null },
      report: plans.some((plan) => plan !== null) ? texturesReport(plans, states, budget.over) : null,
    };
  }, [active, offered, plans, states, budget]);
}

function inputOf(version: MaterialVersion | null, mtl: ParsedModel['materials'] | null): ModelMaterialsInput | null {
  if (!version) return null;
  const { model } = version;
  const mtlByName = new Map((mtl ?? []).map((material) => [material.name, material]));
  const slots = new Map<string, MaterialSlot>();
  for (const mesh of model.meshes) {
    slotKeysOf(model.format, mesh).forEach((key, i) => {
      if (slots.has(key)) return;
      const name = mesh.slots[i]!;
      // An OBJ names its slots, and its `.mtl` defines them by those names.
      const material = model.format === 'obj' ? (mtlByName.get(name) ?? null) : (model.materials[mesh.slotMaterials[i] ?? -1] ?? null);
      slots.set(key, { key, name, material });
    });
  }
  return { format: model.format, slots: [...slots.values()], settings: version.options.settings };
}

/** True from the first time `on` is, until `of` changes: the look's reads and decodes stay while it's off. */
function useLatch(on: boolean, of: unknown): boolean {
  const [latched, setLatched] = useState<{ of: unknown } | null>(null);
  useEffect(() => {
    if (on && latched?.of !== of) setLatched({ of });
  }, [on, of, latched]);
  return on || latched?.of === of;
}

/** An OBJ's `.mtl` materials, read beside it in the workspace on disk; null for another format or while reading. */
function useMtlMaterials(workspacePath: string, versions: Record<'before' | 'after', MaterialVersion | null>): Record<'before' | 'after', ParsedModel['materials'] | null> {
  const files = useMemo(() => SIDES.map((side) => mtlFiles(versions[side])), [versions]);
  const reads = useQueries({
    queries: uniqueFiles(files.flat()).map((source) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', source),
      queryFn: () => api.content.readBytes(workspacePath, source),
      ...contentCaching([source]),
    })),
    combine: dataOf,
  });
  return useMemo(() => {
    const unique = uniqueFiles(files.flat());
    const byPath = new Map(unique.map((source, i) => [source.path, reads[i]]));
    const [before, after] = files.map((sideFiles) => {
      if (sideFiles.length === 0) return null;
      return sideFiles.flatMap((source) => {
        const bytes = byPath.get(source.path);
        return bytes ? readMtlMaterials(new TextDecoder().decode(bytes)) : [];
      });
    });
    return { before: before!, after: after! };
  }, [files, reads]);
}

/** The `.mtl` files an OBJ names, beside it in the workspace on disk; none for another format. */
function mtlFiles(version: MaterialVersion | null): WorkspaceFileSource[] {
  if (!version || version.model.format !== 'obj' || !version.path) return [];
  return objMaterialLibraries(new TextDecoder().decode(version.bytes.bytes)).flatMap((name) => {
    const path = siblingPath(version.path!, name);
    return path === null ? [] : [{ kind: 'workspaceFile', path } satisfies WorkspaceFileSource];
  });
}

/** The reads' bytes, one array while none changes: a function of its own, as TanStack runs a new one each render. */
function dataOf(results: { data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => result.data);
}

/** The reads' bytes, undefined while pending, null for a file that isn't there or a read that failed. */
function settledDataOf(results: { isPending: boolean; isError: boolean; data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => (result.isPending && !result.isError ? undefined : (result.data ?? null)));
}

/** The answers, undefined while being found, null for one that failed. */
function answersOf(results: { isError: boolean; data?: UnityAssetsAnswer | null }[]): (UnityAssetsAnswer | null | undefined)[] {
  return results.map((result) => (result.isError ? null : result.data));
}

/** Each request's answer, undefined while it's being found. */
function useAssets(workspacePath: string, requests: (UnityAssetsRequest | null)[]): (UnityAssetsAnswer | null | undefined)[] {
  // Both versions of a model at one path ask the same: one query (TanStack warns of the same key twice).
  const unique = useMemo(() => uniqueRequests(requests), [requests]);
  const answers = useQueries({
    queries: unique.requests.map((request) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'unityAssets', request),
      queryFn: () => api.unityAssets.find(workspacePath, request),
      // The disk changes under us, as a workspace file's content does.
      staleTime: 0,
    })),
    combine: answersOf,
  });
  return useMemo(() => unique.indices.map((index) => (index === -1 ? null : answers[index])), [unique, answers]);
}

/** The requests once each, and where each of the given ones is among them (-1 for none). */
function uniqueRequests(requests: (UnityAssetsRequest | null)[]): { requests: UnityAssetsRequest[]; indices: number[] } {
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

/** Files once each, by path. */
function uniqueFiles<T extends { path: string }>(files: T[]): T[] {
  return [...new Map(files.map((file) => [file.path, file])).values()];
}

/** The `.mat` files each side's first answer found, read and parsed by GUID; undefined while being read. */
function useUnityMaterials(workspacePath: string, answers: (UnityAssetsAnswer | null | undefined)[], requests: (UnityAssetsRequest | null)[]): (Map<string, UnityMaterial | null> | undefined)[] {
  const files = uniqueFiles(materialFiles(answers, requests).flat().flatMap(({ file }) => (file ? [file] : [])));
  const reads = useQueries({
    queries: files.map((file) => {
      const source: ContentSource = { kind: 'workspaceFile', path: file.path };
      return { queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', source), queryFn: () => api.content.readBytes(workspacePath, source), ...contentCaching([source]) };
    }),
    combine: settledDataOf,
  });
  return useMemo(() => {
    const found = materialFiles(answers, requests);
    const read = uniqueFiles(found.flat().flatMap(({ file }) => (file ? [file] : [])));
    const byPath = new Map(read.map((file, i) => [file.path, reads[i]]));
    return found.map((side, i) => {
      if (answers[i] === undefined || side.some(({ file }) => file && byPath.get(file.path) === undefined)) return requests[i] ? undefined : new Map();
      return new Map(side.map(({ guid, file }) => [guid, file ? materialOf(byPath.get(file.path) ?? null) : null]));
    });
  }, [reads, answers, requests]);
}

/** Each side's remapped materials, by GUID, with the file found for each. */
function materialFiles(answers: (UnityAssetsAnswer | null | undefined)[], requests: (UnityAssetsRequest | null)[]): { guid: string; file: FoundFile | null }[][] {
  return requests.map((request, i) => (request ? request.guids.map((guid, g) => ({ guid, file: answers[i]?.guids[g] ?? null })) : []));
}

function materialOf(bytes: Uint8Array | null): UnityMaterial | null {
  return bytes ? readUnityMaterial(new TextDecoder().decode(bytes)) : null;
}

function foundAssets(first: UnityAssetsRequest, answer: UnityAssetsAnswer | null, second: UnityAssetsRequest | null, secondAnswer: UnityAssetsAnswer | null, materials: Map<string, UnityMaterial | null>): FoundAssets {
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

function emptyFound(): FoundAssets {
  return { textures: new Map(), paths: new Map(), guids: new Map(), materials: new Map(), importsPsb: false };
}

/** What to load for each texture within the budget, by its need: a workspace file, or a glTF's own image. */
function textureLoads(workspacePath: string, { needs, longest }: ReturnType<typeof budgeted>, versions: Record<'before' | 'after', MaterialVersion | null>): Map<string, TextureLoad | null> {
  const loads = new Map<string, TextureLoad | null>();
  for (const need of needs) {
    if (need.where.kind === 'file') {
      const load = { name: need.name, source: { kind: 'workspaceFile' as const, file: need.where.file }, longest, flipY: need.flipY };
      loads.set(need.id, { ...load, key: textureKey(workspacePath, load) });
      continue;
    }
    const version = versions[need.id.startsWith('before:') ? 'before' : 'after'];
    const image = version && gltfImageBytes(version.bytes.bytes, version.bytes.format, need.where.image, version.options.companions);
    if (!version || !image) {
      loads.set(need.id, null);
      continue;
    }
    const load = { name: image.name, source: { kind: 'bytes' as const, bytes: image.bytes, id: `${idOf(version.bytes.bytes)}:${need.where.image}` }, longest, flipY: false };
    loads.set(need.id, { ...load, key: textureKey(workspacePath, load) });
  }
  return loads;
}

const ids = new WeakMap<Uint8Array, number>();
let lastId = 0;

/** An id for a model's bytes while they're kept: its images' decodes are keyed by it. */
function idOf(bytes: Uint8Array): number {
  let id = ids.get(bytes);
  if (id === undefined) ids.set(bytes, (id = ++lastId));
  return id;
}

/** Each need's texture as it decodes; the ones decoded before show at once. */
function useTextureStates(workspacePath: string, loads: Map<string, TextureLoad | null>): Map<string, NeedState> {
  const [decoded, setDecoded] = useState<ReadonlyMap<string, NeedState>>(new Map());
  useEffect(() => {
    let live = true;
    for (const load of loads.values()) {
      if (!load) continue;
      void loadTexture(workspacePath, load).then((result) => {
        if (!live) return;
        const state: NeedState = result.kind === 'decoded' ? { kind: 'ready', key: load.key, bitmap: result.bitmap } : { kind: 'failed', problem: result.problem };
        setDecoded((current) => new Map(current).set(load.key, state));
      });
    }
    return () => {
      live = false;
    };
  }, [workspacePath, loads]);
  return useMemo(() => {
    const states = new Map<string, NeedState>();
    for (const [need, load] of loads) states.set(need, load ? (decoded.get(load.key) ?? { kind: 'loading' }) : { kind: 'failed', problem: 'unreadable' });
    return states;
  }, [loads, decoded]);
}
