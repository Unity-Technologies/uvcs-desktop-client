import { watch } from 'node:fs';

/** A folder being watched. */
export interface FolderWatch {
  close(): void;
  /** The watch broke (the folder went away, the platform gave up): it reports nothing more. */
  onError(listener: () => void): void;
}

/**
 * Starts watching a folder, recursively or not, as `fs.watch` does: `onEvent` gets `rename` (added, deleted, moved) or
 * `change`, and the item's path relative to the folder, or null when the platform didn't say (Windows, when a burst
 * overflowed its buffer). Throws when the folder can't be watched. Tests pass a fake that fires events on demand.
 */
export type WatchFolder = (path: string, recursive: boolean, onEvent: (event: string, fileName: string | null) => void) => FolderWatch;

export const watchFolder: WatchFolder = (path, recursive, onEvent) => {
  const watcher = watch(path, { recursive }, onEvent);
  return {
    close: () => watcher.close(),
    onError: (listener) => watcher.on('error', listener),
  };
};
