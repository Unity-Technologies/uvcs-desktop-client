import { canAnnotate } from '@shared/domain/annotate';
import type { ItemRevision } from '@shared/domain/history';
import { revisionRef } from '@shared/domain/revision';
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
  /** The history is of the workspace's file, which can be reverted, rather than of the item of a revision (browsing, a diff). */
  ofWorkspaceFile: boolean;
  /**
   * The repository of a file under an xlink: its changesets are that one's, which neither the workspace's changeset
   * diffs nor its Branch Explorer have, so the menu doesn't lead there.
   */
  otherRepository?: string;
  /** Shows the revision annotated, selected in the history. */
  annotate: (revision: ItemRevision) => void;
}

export function historyMenu({ workspacePath, path, ofWorkspaceFile, otherRepository, annotate }: HistoryMenuContext, selected: HistoryRow[]): MenuEntry[] {
  const row = selected.length === 1 ? selected[0]! : null;
  const changesetId = row && changesetOf(row);
  const revision = row?.kind === 'revision' ? row.revision : null;
  const isFile = revision !== null && revision.itemType !== 'directory';
  const name = fileNameOf(path);
  const inWorkspaceRepository = row && !otherRepository;

  return groupedMenu([
    inWorkspaceRepository && menuAction('changesetDiff', () => openChangesetDiff({ id: changesetOf(row) }, path), { label: `Open diff of changeset ${changesetId}` }),
    isFile && ofWorkspaceFile && menuAction('revert', () => void revertItemTo(workspacePath, path, revision.changesetId), { label: 'Revert file to this revision…' }),
    isFile && canAnnotate(revision.itemType) && menuAction('annotateRevision', () => annotate(revision)),
    inWorkspaceRepository &&
      menuAction('showInBranchExplorer', () =>
        showInBranchExplorer({ kind: 'changeset', id: changesetOf(row), date: row.kind === 'revision' ? row.revision.date : row.change.date }),
      ),
    isFile && menuAction('openRevision', () => void openRevision(workspacePath, revisionRef(revision), name)),
    isFile && menuAction('saveAs', () => void saveRevisionAs(workspacePath, revisionRef(revision), name)),
    revision && copySubmenu('Revision', { path, spec: revision.idSpec }),
  ]);
}
