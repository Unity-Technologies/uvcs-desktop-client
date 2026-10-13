// When the "What changed" panel tells what changed in the materials (`materialChanges`), and when it can't: the
// decisions `useModelMaterials` makes around the reads (docs/features/model-diff.md, "What changed"). Told only from
// what the workspace answered for both versions: a find that failed, or GUIDs no project's index looked up (a model
// outside a Unity project), answer every asset "not found" without it being so, which would read as missing materials.

import type { UnityAssetsAnswer, UnityAssetsRequest } from '@shared/domain/unityAssets';
import type { ImportSettingsSource } from '../modelImportSettings';
import { materialChanges, materialsMayDiffer, type MaterialChange, type MaterialSide } from './materialChanges';
import type { VersionPlan } from './materialPlan';
import type { UnityMaterial } from './unityMaterial';

/** How far the workspace answered a version's lookups: `unknown` when what it answered can't be taken as so. */
export type AnswerState = 'reading' | 'answered' | 'unknown';

export interface ComparisonInput {
  /** `comparableVersions`. */
  comparable: boolean;
  /** Each version's sources and lookups; undefined while its import settings are read. */
  sides: [MaterialSide | undefined, MaterialSide | undefined];
  answers: [AnswerState, AnswerState];
  /** Null until planned. */
  plans: [VersionPlan | null, VersionPlan | null];
}

/**
 * Whether two versions' materials can be compared: both in a workspace, with a path in it, and a `.meta` read or
 * absent (one whose read failed plans with Unity's defaults, which aren't its settings).
 */
export function comparableVersions(workspacePath: string, versions: readonly ({ path: string | null; options: { settingsFrom: ImportSettingsSource } } | null)[]): boolean {
  return workspacePath !== '' && versions.every((version) => version !== null && version.path !== null && version.options.settingsFrom !== 'failed');
}

/** Whether the versions' materials are read to be compared: only those that may resolve differently. */
export function comparesMaterials({ comparable, sides: [before, after] }: Pick<ComparisonInput, 'comparable' | 'sides'>): boolean {
  return comparable && before !== undefined && after !== undefined && materialsMayDiffer(before, after);
}

/** What changed in the materials: null where it can't be told, undefined while being read, [] when nothing could. */
export function materialChangesOf(input: ComparisonInput): MaterialChange[] | null | undefined {
  if (!input.comparable) return null;
  if (input.sides.some((side) => side === undefined)) return undefined;
  if (!comparesMaterials(input)) return [];
  if (input.answers.includes('unknown')) return null;
  const [before, after] = input.plans;
  return input.answers.includes('reading') || !before || !after ? undefined : materialChanges(before, after);
}

/** How far a version's two rounds of lookups (`assetsRequest`, then its `.mat` files' textures) and reads are answered. */
export function answerStateOf(
  request: UnityAssetsRequest,
  first: UnityAssetsAnswer | null | undefined,
  secondRequest: UnityAssetsRequest | null,
  second: UnityAssetsAnswer | null | undefined,
  materials: ReadonlyMap<string, UnityMaterial | null> | undefined,
): AnswerState {
  const rounds: [UnityAssetsRequest, UnityAssetsAnswer | null | undefined][] = [[request, first], ...(secondRequest ? [[secondRequest, second] as [UnityAssetsRequest, UnityAssetsAnswer | null | undefined]] : [])];
  let state: AnswerState = 'answered';
  for (const [asked, answer] of rounds) {
    if (answer === null || (answer && !answer.guidsIndexed && asksGuids(asked))) return 'unknown';
    if (answer === undefined) state = 'reading';
  }
  return materials === undefined ? 'reading' : state;
}

function asksGuids(request: UnityAssetsRequest): boolean {
  return request.guids.length > 0 || request.textures.some((lookup) => lookup.remapGuid !== null);
}
