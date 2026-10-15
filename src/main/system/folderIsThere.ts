import { access } from 'node:fs/promises';

/**
 * How long a launch waits to learn whether a folder is there: on a local disk it knows in well under a millisecond,
 * and the first window waits for no more than this.
 */
export const FOLDER_LOOKUP_MS = 300;

interface Lookup {
  /** Settles once the folder is found; fails when it isn't there. */
  find?: (path: string) => Promise<void>;
  waitMs?: number;
}

/**
 * Whether a folder is there, without holding the main process the way `existsSync` does: Windows can take many
 * seconds to answer for a folder on a network drive that doesn't (a VPN down, a server asleep). One not found within
 * `waitMs` counts as there, as it may be: what then opens it says so if it isn't (a workspace's page checks it).
 */
export function folderIsThere(path: string, { find = access, waitMs = FOLDER_LOOKUP_MS }: Lookup = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), waitMs);
    const settle = (there: boolean): void => {
      clearTimeout(timer);
      resolve(there);
    };
    find(path).then(
      () => settle(true),
      () => settle(false),
    );
  });
}
