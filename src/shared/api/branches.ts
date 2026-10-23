import type { Branch, CreateBranchRequest } from '../domain/branch';
import type { Place } from '../domain/place';
import type { QueryFilter } from '../domain/query';

export interface BranchesApi {
  list(place: Place, filter: QueryFilter): Promise<Branch[]>;
  /** One branch by its full name (a light `cm find`), or null when there is none. */
  get(place: Place, name: string): Promise<Branch | null>;
  create(place: Place, request: CreateBranchRequest): Promise<void>;
  /** `newName` is the last segment only: renaming `/main/task` to `feature` gives `/main/feature`. */
  rename(place: Place, branch: string, newName: string): Promise<void>;
  /** Replaces the branch's comment; an empty one removes it. */
  editComment(place: Place, branch: string, comment: string): Promise<void>;
  delete(place: Place, branches: string[]): Promise<void>;
  setHidden(place: Place, branches: string[], hidden: boolean): Promise<void>;
  /** The GUIDs of the branches this workspace switched to lately, newest first, from the app's settings. */
  recent(workspacePath: string): Promise<string[]>;
  /** Puts a branch first among the workspace's recent branches (never /main), on every switch. */
  rememberRecent(workspacePath: string, branchGuid: string): Promise<void>;
}
