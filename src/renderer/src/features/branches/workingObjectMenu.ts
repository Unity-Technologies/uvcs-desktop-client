import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { changesetMenu } from '../changesets/changesetMenu';
import { labelMenu } from '../labels/labelMenu';
import { shelveMenu, type ShelveInfo } from '../shelves/shelveMenu';
import { branchMenu } from './branchMenu';

/** What the workspace is loaded from, once read. */
export type WorkingObject =
  | { kind: 'branch'; branch: Branch }
  | { kind: 'changeset'; changeset: Changeset }
  | { kind: 'label'; label: Label }
  | { kind: 'shelve'; shelve: ShelveInfo };

/** Shown while what the workspace is on is still being read. */
const LOADING: MenuEntry[] = [{ id: 'loading', label: 'Loading…', disabled: true, run: () => {} }];

/**
 * The top bar's menu of what the workspace is on: that object's own menu, the one its list and the Branch Explorer
 * show. A shelve there is treated as someone else's: the pill doesn't know whose it is, and deleting stays in the lists.
 */
export function workingObjectMenu(workspace: WorkspaceInfo, object: WorkingObject | undefined): MenuEntry[] {
  const currentBranch = workspace.selector.kind === 'branch' ? workspace.selector.name : undefined;
  switch (object?.kind) {
    case 'branch':
      return branchMenu(workspace.path, [object.branch], currentBranch);
    case 'changeset':
      return changesetMenu({ workspacePath: workspace.path, loadedChangeset: workspace.loadedChangeset, loadedBranch: object.changeset.branch }, [object.changeset]);
    case 'label':
      return labelMenu(workspace.path, [object.label]);
    case 'shelve':
      return shelveMenu(workspace.path, [object.shelve], { mine: false });
    default:
      return LOADING;
  }
}
