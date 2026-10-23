import type { Place } from '../domain/place';
import type { QueryFilter } from '../domain/query';
import type { Shelve, ShelveApplyResult } from '../domain/shelve';

export interface ShelvesApi {
  list(place: Place, filter: QueryFilter): Promise<Shelve[]>;
  /**
   * Merges the shelve into the workspace when nothing conflicts (conflicts are left for the merge view), putting back
   * what shelving it away moved aside, then deletes it if asked. Changes left by a switch or an update are always
   * deleted once back, as when restored from Changes.
   */
  apply(workspacePath: string, shelveId: number, deleteShelve: boolean, operationId: string): Promise<ShelveApplyResult>;
  /** Deletes the shelve, and what this app kept to put it back. */
  delete(place: Place, shelveId: number): Promise<void>;
}
