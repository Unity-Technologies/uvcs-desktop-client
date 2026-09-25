import type { IncomingChanges, IncomingSummary, ShelvedForUpdate, UpdateResolutions, UpdateResult } from '../domain/incoming';
import type { MergePlan, MergeRequest, MergeResolutions, MergeResult } from '../domain/merge';

export interface MergeApi {
  /** What the merge would do, without touching the workspace. */
  preview(workspacePath: string, request: MergeRequest): Promise<MergePlan>;
  /**
   * Runs the merge with the user's resolutions. Workspace merges leave pending changes to check in;
   * merges into a server branch create a changeset.
   */
  run(workspacePath: string, request: MergeRequest, resolutions: MergeResolutions, operationId: string): Promise<MergeResult>;
  incomingSummary(workspacePath: string): Promise<IncomingSummary>;
  incomingChanges(workspacePath: string): Promise<IncomingChanges>;
  /** Updates the workspace, merging locally changed files that also changed on the branch. */
  updateResolvingConflicts(workspacePath: string, resolutions: UpdateResolutions, operationId: string): Promise<UpdateResult>;
  /**
   * Shelves the locally changed files the branch deleted or moved (they block the update), undoes them and updates.
   * The shelve waits in Changes to be restored.
   */
  shelveBlockedAndUpdate(workspacePath: string, operationId: string): Promise<ShelvedForUpdate>;
}
