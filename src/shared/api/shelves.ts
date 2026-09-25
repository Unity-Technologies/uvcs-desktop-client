import type { QueryFilter } from '../domain/query';
import type { Shelve } from '../domain/shelve';

export interface ShelvesApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Shelve[]>;
  delete(workspacePath: string, shelveId: number): Promise<void>;
}
