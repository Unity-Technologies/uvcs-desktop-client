import { AppWindow, Copy, Download, FileDiff, GitGraph, RotateCcw, ScanText } from 'lucide-react';
import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
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

  return groupedMenu({
    primary: [
      row && {
        id: 'changesetDiff',
        label: `Open diff of changeset ${changesetId}`,
        icon: FileDiff,
        run: () => openChangesetDiff({ id: changesetOf(row) }, path),
      },
    ],
    act: [
      isFile && at === undefined && {
        id: 'revert',
        label: 'Revert file to this revision…',
        icon: RotateCcw,
        run: () => void revertItemTo(workspacePath, path, revision.changesetId),
      },
    ],
    navigate: [
      isFile && {
        id: 'annotate',
        label: 'Annotate this revision',
        icon: ScanText,
        run: () => navigation.openPage({ kind: 'annotate', path, revision, changesetId: at }),
      },
      row && {
        id: 'showInBranchExplorer',
        label: 'Show in Branch Explorer',
        icon: GitGraph,
        run: () => showInBranchExplorer({ kind: 'changeset', id: changesetOf(row), date: row.kind === 'revision' ? row.revision.date : row.change.date }),
      },
    ],
    external: [
      isFile && { id: 'open', label: 'Open this revision', icon: AppWindow, run: () => void openRevision(workspacePath, revision.revisionId, name) },
      isFile && {
        id: 'save',
        label: 'Save this revision as…',
        icon: Download,
        run: () => void saveRevisionAs(workspacePath, revision.revisionId, name),
      },
    ],
    copy: [revision && { id: 'copySpec', label: 'Copy revision spec', icon: Copy, run: () => copyToClipboard(revision.spec, 'Revision spec') }],
  });
}
