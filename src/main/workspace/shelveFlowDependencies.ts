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
   * A local read (`cm getworkspacefrompath`) the workspace headers share while fresh (`WorkspaceHeaders.names`): a flow
   * asks for it where it needs it, and a step after a command that rewrote the workspace reads it again, at no server cost.
   */
  kindOf(workspacePath: string): Promise<WorkspaceKind>;
  /** After a command that may have changed the workspace's kind (a partial one switching as standard): the next `kindOf` reads it again. */
  forgetKind(workspacePath: string): void;
}

/**
 * `ShelveFlowDependencies.kindOf` from the workspace headers, which read it with the workspace's name and cache it.
 * A kind `cm` didn't tell runs the standard commands: only a workspace known to be partial needs `cm partial`, and the
 * standard ones are what every workspace ran before partial ones were told apart.
 */
export function kindFromHeaders(headers: { names(workspacePath: string): Promise<WorkspaceNames> }): ShelveFlowDependencies['kindOf'] {
  return (workspacePath) => headers.names(workspacePath).then((names) => names.kind ?? 'standard');
}

/** `kindOf` and `forgetKind` from the workspace headers: forgetting drops their cached reads of the workspace (`WorkspaceHeaders.forget`). */
export function kindDependencies(headers: {
  names(workspacePath: string): Promise<WorkspaceNames>;
  forget(workspacePath: string): void;
}): Pick<ShelveFlowDependencies, 'kindOf' | 'forgetKind'> {
  return { kindOf: kindFromHeaders(headers), forgetKind: (workspacePath) => headers.forget(workspacePath) };
}
