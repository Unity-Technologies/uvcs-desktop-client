// When the "What changed" panel tells what changed in the materials (`materialChanges`), and when it can't: the
// decisions `useModelMaterials` makes around the reads (docs/features/model-diff.md, "What changed"). Told only from
// what the workspace answered for both versions: a find that failed, or a GUID not found that can't be told missing
// (`guidMisses`: a model outside a Unity project, or in one without a `Library`), would read as missing materials.

import type { GuidMisses, UnityAssetsAnswer, UnityAssetsRequest } from '@shared/domain/unityAssets';
import type { ImportSettingsSource } from '../modelImportSettings';
import { materialChanges, materialsMayDiffer, type MaterialChange, type MaterialSide } from './materialChanges';
import type { VersionPlan } from './materialPlan';
import type { UnityMaterial } from './unityMaterial';

/** Why what the workspace answered can't be taken as so (`GuidMisses`); a find that failed is `unread`. */
export type NotKnownReason = Exclude<GuidMisses, 'known'>;

/** How far the workspace answered a version's lookups, or why what it answered can't be taken as so. */
export type AnswerState = 'reading' | 'answered' | NotKnownReason;

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
  if (input.answers.some(isNotKnown)) return null;
  const [before, after] = input.plans;
  return input.answers.includes('reading') || !before || !after ? undefined : materialChanges(before, after);
}

/** The reasons a person can act on first: the project isn't one, then it was never opened in Unity here. */
const REASONS_FIRST: NotKnownReason[] = ['noProject', 'noLibrary', 'unread'];

/**
 * Why materials that may have changed couldn't be compared, for the panel to say so rather than that nothing changed;
 * null when they were, are being read, couldn't have changed, or the versions are no pair to compare.
 */
export function materialsNotComparedOf(input: ComparisonInput): NotKnownReason | null {
  if (!comparesMaterials(input)) return null;
  return REASONS_FIRST.find((reason) => input.answers.includes(reason)) ?? null;
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
    if (answer === null) return 'unread';
    // A file unread leaves any lookup unanswered; no project or Library, only a GUID's.
    if (answer && (answer.guidMisses === 'unread' || (answer.guidMisses !== 'known' && asksGuids(asked)))) return answer.guidMisses;
    if (answer === undefined) state = 'reading';
  }
  return materials === undefined ? 'reading' : state;
}

export function isNotKnown(state: AnswerState): state is NotKnownReason {
  return state !== 'reading' && state !== 'answered';
}

function asksGuids(request: UnityAssetsRequest): boolean {
  return request.guids.length > 0 || request.textures.some((lookup) => lookup.remapGuid !== null);
}
