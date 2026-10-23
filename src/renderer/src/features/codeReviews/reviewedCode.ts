import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { workspacePathOf, type Place } from '@shared/domain/place';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { switchToBranch } from '../branches/branchOperations';
import { switchToChangeset } from '../changesets/changesetOperations';
import { applyShelve } from '../shelves/shelveOperations';

/** How the reviewed code reaches the workspace, with the words of the menu entry (`MENU_WORDS`) it is. */
export interface ReviewedCodeAction {
  word: 'switch' | 'apply';
  label: string;
  /** Why it can't run: the workspace is already there. */
  disabledReason?: string;
  run: () => Promise<unknown>;
}

/**
 * What brings a review's code to the workspace, for the reviewer to run it: the branch's and changeset's own switch
 * (`switchWorkspace`, which asks about pending changes), or the shelve applied as Changes applies someone else's,
 * the shelve kept. Null when the reviewed code is unknown (a deleted branch). `workspaceOn` is what the workspace is
 * on, unknown while it's read: then nothing is disabled, and the switch finds out itself. Reviews are always the
 * place's repository's (`cm find review` runs there), so no target is ever in another repository. Null too in a
 * repository explored without a workspace: there is none to bring the code to.
 */
export function reviewedCodeAction(place: Place, target: CodeReviewTarget, workspaceOn: WorkspaceSelector | undefined): ReviewedCodeAction | null {
  const workspacePath = workspacePathOf(place);
  if (workspacePath === null) return null;
  const isWhereWorkspaceIs = (kind: WorkspaceSelector['kind'], name: string): boolean => workspaceOn?.kind === kind && workspaceOn.name === name;
  switch (target.kind) {
    case 'branch':
      return {
        word: 'switch',
        label: 'Switch to this branch',
        ...(isWhereWorkspaceIs('branch', target.branch) && { disabledReason: 'The workspace is already on this branch' }),
        run: () => switchToBranch(workspacePath, target.branch),
      };
    case 'changeset':
      return {
        word: 'switch',
        label: 'Switch to this changeset',
        // Only a workspace switched to the changeset itself is there: one on a branch whose head it is leaves the branch.
        ...(isWhereWorkspaceIs('changeset', String(target.changesetId)) && { disabledReason: 'The workspace is already on this changeset' }),
        run: () => switchToChangeset(workspacePath, { id: target.changesetId }),
      };
    case 'shelve':
      return {
        word: 'apply',
        label: 'Apply to workspace',
        ...(isWhereWorkspaceIs('shelve', String(target.shelveId)) && { disabledReason: 'The workspace is already on this shelve' }),
        run: () => applyShelve(workspacePath, target.shelveId, false),
      };
    case 'unknown':
      return null;
  }
}
