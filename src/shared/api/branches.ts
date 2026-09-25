import type { Branch, CreateBranchRequest } from '../domain/branch';
import type { QueryFilter } from '../domain/query';

export interface BranchesApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Branch[]>;
  create(workspacePath: string, request: CreateBranchRequest): Promise<void>;
  /** `newName` is the last segment only: renaming `/main/task` to `feature` gives `/main/feature`. */
  rename(workspacePath: string, branch: string, newName: string): Promise<void>;
  delete(workspacePath: string, branches: string[]): Promise<void>;
  setHidden(workspacePath: string, branches: string[], hidden: boolean): Promise<void>;
}
