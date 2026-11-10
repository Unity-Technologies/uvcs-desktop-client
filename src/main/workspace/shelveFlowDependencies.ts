import type { WorkspaceKind } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import type { LeftChangesFinder } from './leftChanges';
import type { SwitchShelveRecords } from './switchShelveRecords';
import type { WorkspaceNames } from './WorkspaceHeaders';

/** What every flow that shelves changes out of the workspace (switch, shelve away, update, loading an xlink) works with. */
export interface ShelveFlowDependencies {
  cm: CmClient;
  records: SwitchShelveRecords;
  /** Puts the changes back when a step fails (`finish`). */
  leftChanges: LeftChangesFinder;
  /**
   * Where files wait outside the workspace: the files the changes added, while the shelve holds them
   * (`moveNewItemsAside`), and the local versions an update merges (`updateWithMerge`).
   */
  backupsRoot: string;
  /**
   * How the workspace at a path holds its files: a partial one updates, switches and checks in with `cm partial`.
   * A local read the workspace headers already cache (`WorkspaceHeaders.names`), so a flow reads it once, at its start.
   */
  kindOf(workspacePath: string): Promise<WorkspaceKind>;
}

/** `ShelveFlowDependencies.kindOf` from the workspace headers, which read it with the workspace's name and cache it. */
export function kindFromHeaders(headers: { names(workspacePath: string): Promise<WorkspaceNames> }): ShelveFlowDependencies['kindOf'] {
  return (workspacePath) => headers.names(workspacePath).then((names) => names.kind);
}
