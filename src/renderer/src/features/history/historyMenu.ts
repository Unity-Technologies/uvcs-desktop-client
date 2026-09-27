import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { groupedMenu } from '../../lib/menuGroups';
import { fileNameOf } from '../../lib/text';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { changesetOf, type HistoryRow } from './historyRows';
import { openRevision, revertItemTo, saveRevisionAs } from './revisionOperations';

interface HistoryMenuContext {
  workspacePath: string;
  path: string;
  /** Set when the history is of the item in a changeset rather than of the workspace's file, which can't be reverted then. */
  changesetId?: number;
}

export function historyMenu({ workspacePath, path, changesetId: at }: HistoryMenuContext, selected: HistoryRow[]): MenuEntry[] {
  const row = selected.length === 1 ? selected[0]! : null;
  const changesetId = row && changesetOf(row);
  const revision = row?.kind === 'revision' ? row.revision : null;
  const isFile = revision !== null && revision.itemType !== 'directory';
  const name = fileNameOf(path);

  return groupedMenu([
    row && menuAction('changesetDiff', () => openChangesetDiff({ id: changesetOf(row) }, path), { label: `Open diff of changeset ${changesetId}` }),
    isFile && at === undefined && menuAction('revert', () => void revertItemTo(workspacePath, path, revision.changesetId), { label: 'Revert file to this revision…' }),
    isFile && menuAction('annotateRevision', () => navigation.openPage({ kind: 'annotate', path, revision, changesetId: at })),
    row &&
      menuAction('showInBranchExplorer', () =>
        showInBranchExplorer({ kind: 'changeset', id: changesetOf(row), date: row.kind === 'revision' ? row.revision.date : row.change.date }),
      ),
    isFile && menuAction('openRevision', () => void openRevision(workspacePath, revision.revisionId, name)),
    isFile && menuAction('saveAs', () => void saveRevisionAs(workspacePath, revision.revisionId, name)),
    revision && copySubmenu('Revision', { path, spec: revision.spec }),
  ]);
}
