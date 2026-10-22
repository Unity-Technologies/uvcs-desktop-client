import type { SmartMergeRequest } from '@shared/domain/mergeTools';
import { unityYamlMergeTakes } from '@shared/unityYaml';
import type { FileConflictState } from '../resolve/useFileConflicts';

/**
 * The versions UnityYAMLMerge gets before a merge tool opens on the file, or null when it doesn't run: once the user
 * decided anything for the file (Start over makes it undecided again), and on any file it doesn't take
 * (`unityYamlMergeTakes`: Unity's YAML on both sides; a `.meta` file goes to the tool). The page already read the
 * versions: UnityYAMLMerge reads nothing from `cm`. An untouched file holds the automatic merge as its decision, which
 * isn't the user's.
 */
export function smartMergeVersions(state: FileConflictState): Omit<SmartMergeRequest, 'sessionId' | 'toolId'> | null {
  if (state.decidedByUser || !isUnityAsset(state)) return null;
  const { base, source, destination } = state.contents!;
  return { path: state.file.path, base: base.text ?? '', yours: destination.text!, incoming: source.text! };
}

/** Both sides are Unity assets (Unity's YAML header, whatever the extension), which UnityYAMLMerge takes (`unityYamlMergeTakes`). */
export function isUnityAsset(state: FileConflictState): boolean {
  if (state.isBinary || !state.contents) return false;
  return unityYamlMergeTakes(state.contents.destination.text, state.contents.source.text);
}
