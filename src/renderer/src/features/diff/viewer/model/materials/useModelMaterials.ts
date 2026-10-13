import { useEffect, useMemo, useState } from 'react';
import { gltfImageBytes } from '../gltfJson';
import { textureLoadsOf, type GltfImage } from '../textures/textureLoadPlan';
import { useTextureStates } from '../textures/useTextureStates';
import { foundAssets, nothingFound, textureRequestOf } from './assetAnswers';
import { assetsRequest, budgeted, planVersion, slotLooks, texturesReport, type Side, type SlotLook, type TexturesReport, type VersionPlan } from './materialPlan';
import { materialsInputOf, type MaterialVersion } from './materialVersion';
import { materialsOffered, slotSources } from './slotSources';
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
}

const SIDES = ['before', 'after'] as const;
const NO_LOOKS = { before: null, after: null };

/**
 * The Materials look for a model's versions (docs/features/model-diff.md, "Materials"): whether it's offered, and,
 * once `wanted`, each slot's material and textures as Unity would show them, read from the workspace on disk (never
 * the server: no `cm` command), textures appearing as they decode. Turned off, what was read and decoded stays until
 * the versions change, so turning it on again is immediate.
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
  const requests = useMemo(
    () => SIDES.map((side) => (active && inputs[side] && sources[side] && versions[side]?.path ? assetsRequest(inputs[side]!, sources[side]!, versions[side]!.path!) : null)),
    [active, inputs, sources, versions],
  );
  const firstAnswers = useUnityAssets(workspacePath, requests);
  const materials = useUnityMaterials(workspacePath, firstAnswers, requests);
  const secondRequests = useMemo(() => requests.map((request, i) => textureRequestOf(request, materials[i])), [requests, materials]);
  const secondAnswers = useUnityAssets(workspacePath, secondRequests);

  const plans = useMemo((): (VersionPlan | null)[] => {
    if (!active) return [null, null];
    return SIDES.map((side, i) => {
      const input = inputs[side];
      const version = versions[side];
      const request = requests[i];
      if (!input || !version || !sources[side]) return null;
      // Without a path in the workspace, only what the file holds (a glTF's own images) can show.
      if (!request) return planVersion(input, sources[side]!, nothingFound(), version.path ?? '', side);
      const first = firstAnswers[i];
      if (first === undefined || (secondRequests[i] && secondAnswers[i] === undefined) || materials[i] === undefined) return null;
      return planVersion(input, sources[side]!, foundAssets(request, first, secondRequests[i] ?? null, secondAnswers[i] ?? null, materials[i]!), request.modelPath, side);
    });
  }, [active, inputs, versions, sources, requests, firstAnswers, secondRequests, secondAnswers, materials]);

  const budget = useMemo(() => budgeted(plans), [plans]);
  const loads = useMemo(() => textureLoadsOf(workspacePath, budget.needs, budget.longest, (side, image) => gltfImageOf(versions[side], image)), [workspacePath, budget, versions]);
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
