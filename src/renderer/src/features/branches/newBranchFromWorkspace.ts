import type { WorkspaceInfo } from '@shared/domain/workspace';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { openCreateBranchDialog, type NewBranchOrigin } from './CreateBranchDialog';

const MAIN_BRANCH = '/main';

/**
 * Opens the new-branch dialog for the workspace. Away from /main it offers two starting points:
 * the latest /main (something new) or what the workspace has loaded (building on it).
 */
export async function newBranchFromWorkspace(workspace: WorkspaceInfo): Promise<void> {
  const loaded = loadedOrigin(workspace);
  if (workspace.selector.kind === 'branch' && workspace.selector.name === MAIN_BRANCH) {
    openCreateBranchDialog(workspace.path, loaded);
    return;
  }

  const [mainHead] = await api.changesets.list(workspace.path, { branch: MAIN_BRANCH, limit: 1 }).catch(() => []);
  if (!mainHead) {
    openCreateBranchDialog(workspace.path, loaded);
    return;
  }
  openCreateBranchDialog(
    workspace.path,
    {
      parentBranch: MAIN_BRANCH,
      startingPoint: spec.changeset(mainHead.id),
      startingPointLabel: `the latest ${MAIN_BRANCH} (changeset ${mainHead.id})`,
      card: { title: `${MAIN_BRANCH} (latest, changeset ${mainHead.id})`, description: 'Start something new, independent of your current work.' },
    },
    loaded,
  );
}

/** What the workspace has loaded. A label stays a label, so the branch records where it came from. */
function loadedOrigin(workspace: WorkspaceInfo): NewBranchOrigin {
  const { selector, loadedChangeset } = workspace;
  const card = { title: '', description: 'Continue building on its existing changes.' };

  if (selector.kind === 'label') {
    return {
      parentBranch: MAIN_BRANCH,
      startingPoint: spec.label(selector.name),
      startingPointLabel: `label ${selector.name} (changeset ${loadedChangeset})`,
      card: { ...card, title: `Label ${selector.name} (changeset ${loadedChangeset}, what you have loaded)` },
    };
  }
  const name = selector.kind === 'branch' ? selector.name : `changeset ${loadedChangeset}`;
  return {
    parentBranch: selector.kind === 'branch' ? selector.name : MAIN_BRANCH,
    startingPoint: spec.changeset(loadedChangeset),
    startingPointLabel: `your workspace's changeset ${loadedChangeset}`,
    card: { ...card, title: selector.kind === 'branch' ? `${name} (changeset ${loadedChangeset}, what you have loaded)` : `Changeset ${loadedChangeset} (what you have loaded)` },
  };
}
