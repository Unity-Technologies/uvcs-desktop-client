import type { WatchFolder } from '../watchFolder';

interface FakeWatch {
  recursive: boolean;
  onEvent: (event: string, fileName: string | null) => void;
  onError?: () => void;
}

/**
 * A `WatchFolder` whose watches fire when the test says, as the platform would: `emit(folder, 'change', 'a.txt')`.
 * Folders listed in `unwatchable` can't be watched (recursively, with `{ recursive: true }` entries).
 */
export function fakeFolderWatches(unwatchable: { path: string; recursive?: boolean }[] = []) {
  const watches = new Map<string, FakeWatch>();

  const watch: WatchFolder = (path, recursive, onEvent) => {
    if (unwatchable.some((folder) => folder.path === path && (folder.recursive === undefined || folder.recursive === recursive))) {
      throw Object.assign(new Error(`ENOSPC: System limit for number of file watchers reached, watch '${path}'`), { code: 'ENOSPC' });
    }
    const entry: FakeWatch = { recursive, onEvent };
    watches.set(path, entry);
    return {
      close: () => void (watches.get(path) === entry && watches.delete(path)),
      onError: (listener) => void (entry.onError = listener),
    };
  };

  const watchOf = (path: string): FakeWatch => {
    const entry = watches.get(path);
    if (!entry) throw new Error(`Nothing watches ${path}`);
    return entry;
  };

  return {
    watch,
    /** The folders watched now, and whether recursively. */
    watched: (): Map<string, boolean> => new Map([...watches].map(([path, entry]) => [path, entry.recursive])),
    /** The watch on `folder` reports `event` for `fileName` (relative to it; null: the platform didn't say). */
    emit: (folder: string, event: 'rename' | 'change', fileName: string | null): void => watchOf(folder).onEvent(event, fileName),
    /** The watch on `folder` breaks. */
    break: (folder: string): void => watchOf(folder).onError?.(),
  };
}
