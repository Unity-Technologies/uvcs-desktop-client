import { fileNameOf } from '../../lib/text';
import { ancestorsOf } from '../files/fileTreeRows';
import { downloadChangeMarker, downloadChangeOf, type DownloadChange } from './downloadTree';
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
 * The folders whose loaded items a search's results need, so each shows whether it's loaded: every folder above each
 * result (the dialog reads those the workspace holds anything of, `foldersToReadLoaded`). Only the workspace's side, a
 * local read: the repository's listings of these folders are read only once the user ticks a result, which opens the
 * folders above it (`choicesAwaitReads`).
 */
export function foldersAboveResults(paths: readonly string[]): string[] {
  return [...new Set(paths.flatMap(ancestorsOf))];
}

/**
 * The folders above every result shown so far, kept while the dialog is open so typing on doesn't read them again as
 * results come and go: `known` itself when the results add none, so a caller can tell nothing changed.
 */
export function foldersOfResultsSoFar(known: ReadonlySet<string>, paths: readonly string[]): ReadonlySet<string> {
  const added = foldersAboveResults(paths).filter((folder) => !known.has(folder));
  return added.length === 0 ? known : new Set([...known, ...added]);
}

/** What a search result shows before its name and at its end. */
export type DownloadSearchRow =
  /** Whether it's loaded is still being read: a spinner stands for its checkbox. */
  | { kind: 'loading' }
  /** A folder above it couldn't be read: it can't be chosen, and says why. */
  | { kind: 'failed'; failure: string }
  | { kind: 'check'; check: CheckState; label: string; change: DownloadChange; marker: 'Download' | 'Remove' | undefined };

/** A search result's checkbox and what Apply does to it, as the tree shows them for the same item. */
export function downloadSearchRow(
  path: string,
  tree: DownloadTree,
  choices: DownloadedChoices,
  failures: ReadonlyMap<string, string>,
): DownloadSearchRow {
  const failure = [ROOT, ...ancestorsOf(path)].map((folder) => failures.get(folder)).find((message) => message !== undefined);
  if (failure !== undefined) return { kind: 'failed', failure };
  if (!isLoadKnown(path, tree)) return { kind: 'loading' };
  const check = checkStateOf(path, tree, choices);
  const change = downloadChangeOf(check, isLoaded(path, tree));
  return { kind: 'check', check, label: fileNameOf(path), change, marker: downloadChangeMarker(change) };
}

/**
 * Whether a choice waits for folders above it to be read: the rules walk the tree from its root (`downloadRules`), so
 * a choice in a folder not read yet would make none. Ticking a search's result reads those folders; Apply waits. A
 * folder that couldn't be read waits for nothing: its row says so, and the rules leave out what's below it.
 */
export function choicesAwaitReads(tree: DownloadTree, choices: DownloadedChoices, failures: ReadonlyMap<string, string>): boolean {
  return [...choices.keys()].some((path) =>
    [ROOT, ...ancestorsOf(path)].some((folder) => !isFolderRead(folder, tree) && !failures.has(folder)),
  );
}
