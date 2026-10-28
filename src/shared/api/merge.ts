import type { IncomingChangesetPage, IncomingChangesetsRequest, IncomingChanges, IncomingSummary, LoadedBranch, ShelvedForUpdate, UpdateResolutions, UpdateResult } from '../domain/incoming';
import type { DecidedMerge, DirectoryDecision, MergePlan, MergeRequest, MergeResolutions, MergeResult } from '../domain/merge';

export interface MergeApi {
  /** What the merge would do, without touching the workspace. */
  preview(workspacePath: string, request: MergeRequest): Promise<MergePlan>;
  /**
   * Applies the merge page's directory decisions, in order, as the user makes them, and returns the merge calculated
   * again on them: a decision can move, remove or add file conflicts and changes. Nothing in the workspace changes.
   * `decisionsId` names the page's decisions, kept until `discardDirectoryDecisions`; the merge goes on from them
   * (`MergeResolutions.directoryDecisionsId`). A decision whose conflict an earlier one took out of the merge, or moved
   * (it's then another conflict, decided again), is dropped.
   */
  decideDirectoryConflicts(workspacePath: string, request: MergeRequest, decisionsId: string, decisions: DirectoryDecision[]): Promise<DecidedMerge>;
  /** Forgets a merge page's directory decisions: the page closed. */
  discardDirectoryDecisions(decisionsId: string): Promise<void>;
  /**
   * Runs the merge with the user's resolutions. Workspace merges leave pending changes to check in;
   * merges into a server branch create a changeset.
   */
  run(workspacePath: string, request: MergeRequest, resolutions: MergeResolutions, operationId: string): Promise<MergeResult>;
  /**
   * The changeset that merged `sourceChangeset` into `destinationBranch` (e.g. a task branch's head into its parent), or
   * null when it wasn't merged there. One `cm find merge` returning a single link.
   */
  mergedInto(workspacePath: string, sourceChangeset: number, destinationBranch: string): Promise<number | null>;
  /**
   * One light `cm find` for the newest changesets on `loaded.branch` after the loaded one, at most 100 of them however
   * far behind the workspace is (`countCapped` beyond); polled, so it reads nothing else.
   */
  incomingSummary(workspacePath: string, loaded: LoadedBranch): Promise<IncomingSummary>;
  /** What updating brings: the newest page of changesets, one diff from the loaded changeset to the head, and what collides locally. */
  incomingChanges(workspacePath: string): Promise<IncomingChanges>;
  /** One page of the incoming changesets: the incoming card's newest few, or Incoming's older ones. */
  incomingChangesets(workspacePath: string, request: IncomingChangesetsRequest): Promise<IncomingChangesetPage>;
  /** Updates the workspace, merging locally changed files that also changed on the branch. */
  updateResolvingConflicts(workspacePath: string, resolutions: UpdateResolutions, operationId: string): Promise<UpdateResult>;
  /**
   * Shelves the locally changed files the branch deleted or moved (they block the update), undoes them and updates,
   * merging the files changed on both sides with `resolutions` (null or incomplete: it stops before updating).
   * The shelve waits in Changes to be restored.
   */
  shelveBlockedAndUpdate(workspacePath: string, resolutions: UpdateResolutions | null, operationId: string): Promise<ShelvedForUpdate>;
}
