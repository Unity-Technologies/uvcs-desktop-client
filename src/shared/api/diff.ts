import type { DiffEntry, DiffTarget, XlinkSides } from '../domain/diff';
import type { Place } from '../domain/place';

export interface DiffApi {
  /** Items that differ for the target, sorted by path. */
  entries(place: Place, target: DiffTarget): Promise<DiffEntry[]>;
  /**
   * Where one of the target's changed xlinks points before and after: a branch's before is where the branch started
   * (its base changeset), which `--integration`'s common ancestor matches unless the branch merged from its parent.
   */
  xlinkSides(place: Place, target: DiffTarget, xlink: Pick<DiffEntry, 'path' | 'oldPath' | 'status'>): Promise<XlinkSides>;
}
