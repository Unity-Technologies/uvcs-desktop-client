import type { DiffEntry, DiffTarget, XlinkSides } from '../domain/diff';

export interface DiffApi {
  /** Items that differ for the target, sorted by path. */
  entries(workspacePath: string, target: DiffTarget): Promise<DiffEntry[]>;
  /**
   * Where one of the target's changed xlinks points before and after: a branch's before is where the branch started
   * (its base changeset), which `--integration`'s common ancestor matches unless the branch merged from its parent.
   */
  xlinkSides(workspacePath: string, target: DiffTarget, xlink: Pick<DiffEntry, 'path' | 'oldPath' | 'status'>): Promise<XlinkSides>;
}
