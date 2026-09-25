import type { Changeset } from '../domain/changeset';
import type { QueryFilter } from '../domain/query';

export interface ChangesetsApi {
  /** Newest first. */
  list(workspacePath: string, filter: QueryFilter): Promise<Changeset[]>;
}
