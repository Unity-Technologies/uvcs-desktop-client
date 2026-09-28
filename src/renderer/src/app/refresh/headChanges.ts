import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';

type LoadedState = Pick<WorkspaceInfo, 'selector' | 'loadedChangeset'>;

/** The workspace now loads another changeset, branch, label or shelve (a checkin, update or switch). */
export function loadedChangesetChanged(before: LoadedState, after: LoadedState): boolean {
  return (
    before.loadedChangeset !== after.loadedChangeset || before.selector.kind !== after.selector.kind || before.selector.name !== after.selector.name
  );
}

/** The part of the workspace info that a query's key holds (`WORKSPACE_INFO_KEYED`). */
export type WorkspaceInfoPart = 'selector' | 'loadedChangeset';

/** Whether a query keyed by `part` of the workspace info has another key now. */
export function workspaceInfoKeyMoved(part: WorkspaceInfoPart, before: LoadedState, after: LoadedState): boolean {
  if (part === 'loadedChangeset') return loadedChangesetChanged(before, after);
  return before.selector.kind !== after.selector.kind || before.selector.name !== after.selector.name;
}

/**
 * Someone else checked in to the loaded branch: its head moved while the workspace stayed where it was.
 * Our own checkins and updates move the loaded changeset too, and refresh everything by themselves.
 */
export function branchHeadMovedOnServer(before: IncomingSummary, after: IncomingSummary): boolean {
  if (!before.branch || !after.branch) return false;
  return before.branch === after.branch && before.loadedChangeset === after.loadedChangeset && before.headChangeset !== after.headChangeset;
}
