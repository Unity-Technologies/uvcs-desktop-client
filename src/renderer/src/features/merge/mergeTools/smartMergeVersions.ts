import type { SmartMergeRequest } from '@shared/domain/mergeTools';
import { isUnityYaml } from '@shared/unityYaml';
import type { FileConflictState } from '../resolve/useFileConflicts';

/**
 * The versions Smart Merge gets before a merge tool opens on the file, or null when it doesn't run: once the user
 * decided anything for the file (Start over makes it undecided again), and on anything but a Unity asset on both
 * sides (a `.meta` file has no Unity header: it goes to the tool). The page already read the versions: Smart Merge reads
 * nothing from `cm`. An untouched file holds the automatic merge as its decision, which isn't the user's.
 */
export function smartMergeVersions(state: FileConflictState): Omit<SmartMergeRequest, 'sessionId'> | null {
  if (state.decidedByUser || !isUnityAsset(state)) return null;
  const { base, source, destination } = state.contents!;
  return { path: state.file.path, base: base.text ?? '', yours: destination.text!, incoming: source.text! };
}

/** Both sides are Unity assets (Unity's YAML header, whatever the extension), which Smart Merge merges first. */
export function isUnityAsset(state: FileConflictState): boolean {
  if (state.isBinary || !state.contents) return false;
  const { source, destination } = state.contents;
  return source.text !== undefined && destination.text !== undefined && isUnityYaml(source.text) && isUnityYaml(destination.text);
}
