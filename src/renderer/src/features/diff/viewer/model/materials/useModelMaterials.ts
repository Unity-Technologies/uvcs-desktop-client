import { useEffect, useMemo, useState } from 'react';
import type { UnityAssetsRequest } from '@shared/domain/unityAssets';
import { gltfImageBytes } from '../gltfJson';
import { textureLoadsOf, type GltfImage } from '../textures/textureLoadPlan';
import { useTextureStates } from '../textures/useTextureStates';
import { foundAssets, nothingFound, textureRequestOf } from './assetAnswers';
import type { MaterialChange, MaterialSide } from './materialChanges';
import {
  answerStateOf,
  comparableVersions,
  comparesMaterials,
  materialChangesOf,
  materialsNotComparedOf,
  type AnswerState,
  type ComparisonInput,
  type NotKnownReason,
} from './materialComparison';
import { assetsRequest, budgeted, planVersion, slotLooks, texturesReport, type Side, type SlotLook, type TexturesReport, type VersionPlan } from './materialPlan';
import { materialsInputOf, type MaterialVersion } from './materialVersion';
import { materialsOffered, slotSources, type SlotSource } from './slotSources';
import { useMtlMaterials } from './useMtlMaterials';
import { useUnityAssets, useUnityMaterials } from './useUnityAssets';
import { useWorkspaceImportSettings } from './useWorkspaceImportSettings';

export type { MaterialVersion } from './materialVersion';

export interface ModelMaterials {
  /** Whether the look shows anything the clay doesn't (`materialsOffered`). */
  offered: boolean;
  /** Each side's slots as drawn now; null until the look was first turned on for these versions. */
  looks: Record<Side, ReadonlyMap<string, SlotLook> | null>;
  report: TexturesReport | null;
  /**
   * What changed in the slots' materials (`materialChanges`), whether the look is on or not: undefined while being
   * read, null where it can't be told (no workspace, a version alone, or one with no path in the workspace).
   */
  changes: MaterialChange[] | null | undefined;
  /** Why materials that may have changed couldn't be compared (`materialsNotComparedOf`). */
  notCompared: NotKnownReason | null;
}

const SIDES = ['before', 'after'] as const;
const NO_LOOKS = { before: null, after: null };
const NO_PLANS: (VersionPlan | null)[] = [null, null];
/** A side with no version to plan: nothing to find. */
const NO_PLAN: VersionPlan = { slots: new Map(), resolved: new Map(), needs: [], issues: [] };
const NO_REQUESTS = [null, null];

/**
 * The Materials look for a model's versions (docs/features/model-diff.md, "Materials"): whether it's offered, and,
 * once `wanted`, each slot's material and textures as Unity would show them, found where each version is (its
 * `AssetsPoint`: the disk, or the repository's tree at its point, `api.unityAssets.find`), textures appearing as they
 * download and decode. Turned off, what was read and decoded stays until
 * the versions change, so turning it on again is immediate. What changed in the materials is told with the look off
 * too, from the same reads (so the look reads nothing again), and only for versions whose materials may resolve
 * differently (`materialsMayDiffer`); no texture is decoded for it.
 */
export function useModelMaterials(workspacePath: string, versions: Record<Side, MaterialVersion | null>, wanted: boolean): ModelMaterials {
  const mtl = useMtlMaterials(workspacePath, versions);
  const workspaceSettings = useWorkspaceImportSettings(workspacePath, versions);
  const inputs = useMemo(
    () => ({
      before: materialsInputOf(versions.before, mtl.before, workspaceSettings.before),
      after: materialsInputOf(versions.after, mtl.after, workspaceSettings.after),
    }),
    [versions.before, versions.after, mtl.before, mtl.after, workspaceSettings],
  );
  const offered = workspacePath !== '' && materialsOffered([inputs.before ?? null, inputs.after ?? null]);
  const active = useLatch(wanted && offered, inputs);

  const sources = useMemo(() => ({ before: inputs.before && slotSources(inputs.before), after: inputs.after && slotSources(inputs.after) }), [inputs]);
  const sideRequests = useMemo(
    () =>
      SIDES.map((side) => {
        const version = versions[side];
        return inputs[side] && sources[side] && version?.path && version.point ? assetsRequest(inputs[side]!, sources[side]!, version.path, version.point) : null;
      }),
    [inputs, sources, versions],
  );
  const comparison = useMemo(
    (): Pick<ComparisonInput, 'comparable' | 'sides'> => ({
      comparable: comparableVersions(workspacePath, [versions.before, versions.after]),
      sides: [sideOf(sources.before, sideRequests[0]), sideOf(sources.after, sideRequests[1])],
    }),
    [workspacePath, versions, sources, sideRequests],
  );
  const comparing = useMemo(() => comparesMaterials(comparison), [comparison]);
  const reading = active || comparing;
  const requests = useMemo(() => (reading ? sideRequests : NO_REQUESTS), [reading, sideRequests]);
  const firstAnswers = useUnityAssets(workspacePath, requests);
  const materials = useUnityMaterials(workspacePath, firstAnswers, requests);
  const secondRequests = useMemo(() => requests.map((request, i) => textureRequestOf(request, materials[i])), [requests, materials]);
  const secondAnswers = useUnityAssets(workspacePath, secondRequests);

  const plans = useMemo((): (VersionPlan | null)[] => {
    if (!reading) return NO_PLANS;
    return SIDES.map((side, i) => {
      const input = inputs[side];
      const version = versions[side];
      const request = requests[i];
      if (!input || !version || !sources[side]) return null;
      // Without a path in the workspace or a point to look at, only what the file holds (a glTF's own images) can show.
      if (!request) return planVersion(input, sources[side]!, nothingFound(), version.path ?? '', side);
      const first = firstAnswers[i];
      if (first === undefined || (secondRequests[i] && secondAnswers[i] === undefined) || materials[i] === undefined) return null;
      return planVersion(input, sources[side]!, foundAssets(request, first, secondRequests[i] ?? null, secondAnswers[i] ?? null, materials[i]!), request.modelPath, side);
    });
  }, [reading, inputs, versions, sources, requests, firstAnswers, secondRequests, secondAnswers, materials]);

  // Textures decode only for the look: the changes need none.
  const budget = useMemo(() => budgeted(active ? plans : NO_PLANS), [active, plans]);
  const loads = useMemo(() => textureLoadsOf(workspacePath, budget.needs, budget.longest, (side, image) => gltfImageOf(versions[side], image)), [workspacePath, budget, versions]);
  const states = useTextureStates(workspacePath, loads);

  const { changes, notCompared } = useMemo(() => {
    const answerOf = (i: number): AnswerState => {
      const request = requests[i];
      return request ? answerStateOf(request, firstAnswers[i], secondRequests[i] ?? null, secondAnswers[i], materials[i]) : 'reading';
    };
    const input: ComparisonInput = { ...comparison, answers: [answerOf(0), answerOf(1)], plans: [plans[0] ?? null, plans[1] ?? null] };
    return { changes: materialChangesOf(input), notCompared: materialsNotComparedOf(input) };
  }, [comparison, requests, firstAnswers, secondRequests, secondAnswers, materials, plans]);

  return useMemo((): ModelMaterials => {
    if (!active) return { offered, looks: NO_LOOKS, report: null, changes, notCompared };
    const [before, after] = plans;
    return {
      changes,
      notCompared,
      offered,
      looks: { before: before ? slotLooks(before, states) : null, after: after ? slotLooks(after, states) : null },
      // From the look's first moment: finding what a version's materials use may take a while (a project's listing).
      report: texturesReport(SIDES.map((side, i) => (versions[side] ? plans[i]! : NO_PLAN)), states, budget.over),
    };
  }, [active, offered, plans, states, budget, changes, notCompared, versions]);
}

/** True from the first time `on` is, until `of` changes: the look's reads and decodes stay while it's off. */
function useLatch(on: boolean, of: unknown): boolean {
  const [latched, setLatched] = useState<{ of: unknown } | null>(null);
  useEffect(() => {
    if (on && latched?.of !== of) setLatched({ of });
  }, [on, of, latched]);
  return on || latched?.of === of;
}

/** An image a version's glTF holds, by an id kept while its bytes are. */
function gltfImageOf(version: MaterialVersion | null, image: number): GltfImage | null {
  const read = version && gltfImageBytes(version.bytes.bytes, version.bytes.format, image, version.options.companions);
  return version && read ? { ...read, id: `${idOf(version.bytes.bytes)}:${image}` } : null;
}

const ids = new WeakMap<Uint8Array, number>();
let lastId = 0;

/** An id for a model's bytes while they're kept: its images' decodes are keyed by it. */
function idOf(bytes: Uint8Array): number {
  let id = ids.get(bytes);
  if (id === undefined) ids.set(bytes, (id = ++lastId));
  return id;
}

function sideOf(sources: Map<string, SlotSource> | null | undefined, request: UnityAssetsRequest | null | undefined): MaterialSide | undefined {
  return sources ? { sources, request: request ?? null } : undefined;
}
