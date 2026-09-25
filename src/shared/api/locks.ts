import type { Lock } from '../domain/lock';

export interface LocksApi {
  /** Locks of the given repository, in any status; `onlyThisWorkspace` keeps those taken from this workspace. */
  list(workspacePath: string, repository: string, options: { onlyMine: boolean; onlyThisWorkspace?: boolean }): Promise<Lock[]>;
  /** Releases the locks; with `remove`, deletes them entirely (administrators only). */
  unlock(workspacePath: string, locks: Pick<Lock, 'itemId' | 'repository'>[], options: { remove: boolean }): Promise<void>;
}
