import type { Branch } from '../domain/branch';
import type { QueryFilter } from '../domain/query';

export interface BranchesApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Branch[]>;
}
