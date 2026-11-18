import { ancestorsOf } from '../files/fileTreeRows';
import { downloadChangeOf, type DownloadChange } from './downloadTree';
import { checkStateOf, isFolderRead, isLoaded, type DownloadTree, type DownloadedChoices } from './downloadSelection';
import type { CheckState } from '../../ui/Checkbox';

const ROOT = '';

/**
 * Whether the workspace's side tells if `path` is loaded: every folder above it the workspace holds anything of has
 * its loaded items read. Below a folder it holds nothing of, nothing is loaded, so nothing deeper needs reading.
 */
export function isLoadKnown(path: string, tree: DownloadTree): boolean {
  for (const folder of [ROOT, ...ancestorsOf(path)]) {
    if (!isLoaded(folder, tree)) return true;
    if (!tree.loadedIn.has(folder)) return false;
  }
  return true;
}

/**
 * The folders whose loaded items a search's results need, so each shows whether it's loaded: those above each result
 * (`foldersToReadLoaded` keeps the ones the workspace holds anything of). Only the workspace's side, a local read: the
 * repository's listings of these folders are read only once the user ticks a result (`searchTicked`).
 */
export function foldersAboveResults(paths: readonly string[]): string[] {
  return [...new Set(paths.flatMap(ancestorsOf))];
}

/** A search result's checkbox and what Apply does to it; undefined while whether it's loaded is still being read. */
export function downloadSearchCheck(
  path: string,
  tree: DownloadTree,
  choices: DownloadedChoices,
): { check: CheckState; change: DownloadChange } | undefined {
  if (!isLoadKnown(path, tree)) return undefined;
  const check = checkStateOf(path, tree, choices);
  return { check, change: downloadChangeOf(check, isLoaded(path, tree)) };
}

/**
 * Whether a choice waits for folders above it to be read: the rules walk the tree from its root (`downloadRules`), so
 * a choice in a folder not read yet would make none. Ticking a search's result reads those folders; Apply waits.
 */
export function choicesAwaitReads(tree: DownloadTree, choices: DownloadedChoices): boolean {
  return [...choices.keys()].some((path) => [ROOT, ...ancestorsOf(path)].some((folder) => !isFolderRead(folder, tree)));
}
