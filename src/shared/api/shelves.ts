import type { QueryFilter } from '../domain/query';
import type { Shelve, ShelveApplyPreview } from '../domain/shelve';

export interface ShelvesApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Shelve[]>;
  /** What applying the shelve would do, without touching the workspace. */
  previewApply(workspacePath: string, shelveId: number): Promise<ShelveApplyPreview>;
  /** Applies a shelve that has no conflicts. Shelves with conflicts go through the merge view. */
  apply(workspacePath: string, shelveId: number, operationId: string): Promise<void>;
  delete(workspacePath: string, shelveId: number): Promise<void>;
}
