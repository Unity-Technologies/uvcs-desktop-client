import type { SmartMergeRequest } from '@shared/domain/mergeTools';
import { unityYamlMergeTakes } from '@shared/unityYaml';
import type { FileConflictState } from '../resolve/useFileConflicts';

/**
 * The versions UnityYAMLMerge gets before a merge tool opens on the file, or null when it doesn't run: once the user
 * decided anything for the file (Start over makes it undecided again), and on any file it doesn't take
 * (`unityYamlMergeTakes`: Unity's YAML on both sides, or a `.meta` file). The page already read the versions:
 * UnityYAMLMerge reads nothing from `cm`. An untouched file holds the automatic merge as its decision, which isn't the
 * user's. `ignoreCase`: whether file names ignore case here (`fileNamesIgnoreCase`).
 */
export function smartMergeVersions(state: FileConflictState, ignoreCase: boolean): Omit<SmartMergeRequest, 'sessionId' | 'toolId'> | null {
  if (state.decidedByUser || !isUnityAsset(state, ignoreCase)) return null;
  const { base, source, destination } = state.contents!;
  return { path: state.file.path, base: base.text ?? '', yours: destination.text!, incoming: source.text! };
}

/** UnityYAMLMerge takes the file: text on both sides, Unity's YAML or a `.meta` file (`unityYamlMergeTakes`). */
export function isUnityAsset(state: FileConflictState, ignoreCase: boolean): boolean {
  if (state.isBinary || !state.contents) return false;
  return unityYamlMergeTakes(state.file.path, state.contents.destination.text, state.contents.source.text, ignoreCase);
}
