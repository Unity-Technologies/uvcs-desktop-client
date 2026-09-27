import { AppWindow, Copy, Download, FileDiff, GitGraph, RotateCcw, ScanText } from 'lucide-react';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { fileNameOf } from '../../lib/text';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { changesetOf, type HistoryRow } from './historyRows';
import { openRevision, revertItemTo, saveRevisionAs } from './revisionOperations';

interface HistoryMenuContext {
  workspacePath: string;
  path: string;
}

export function historyMenu({ workspacePath, path }: HistoryMenuContext, selected: HistoryRow[]): MenuEntry[] {
  const row = selected.length === 1 ? selected[0]! : null;
  const changesetId = row && changesetOf(row);
  const revision = row?.kind === 'revision' ? row.revision : null;
  const isFile = revision !== null && revision.itemType !== 'directory';
  const name = fileNameOf(path);

  return tidyMenu([
    row && {
      id: 'changesetDiff',
      label: `Diff changeset ${changesetId}`,
      icon: FileDiff,
      run: () => openChangesetDiff({ id: changesetOf(row) }, path),
    },
    row && {
      id: 'showInBranchExplorer',
      label: 'Show changeset in Branch Explorer',
      icon: GitGraph,
      run: () => showInBranchExplorer({ kind: 'changeset', id: changesetOf(row), date: row.kind === 'revision' ? row.revision.date : row.change.date }),
    },
    isFile && {
      id: 'annotate',
      label: 'Annotate this revision',
      icon: ScanText,
      run: () => navigation.openPage({ kind: 'annotate', path, revision }),
    },
    SEPARATOR,
    isFile && { id: 'open', label: 'Open this revision', icon: AppWindow, run: () => void openRevision(workspacePath, revision.revisionId, name) },
    isFile && {
      id: 'save',
      label: 'Save this revision as…',
      icon: Download,
      run: () => void saveRevisionAs(workspacePath, revision.revisionId, name),
    },
    isFile && {
      id: 'revert',
      label: 'Revert file to this revision…',
      icon: RotateCcw,
      run: () => void revertItemTo(workspacePath, path, revision.changesetId),
    },
    SEPARATOR,
    revision && { id: 'copySpec', label: 'Copy revision spec', icon: Copy, run: () => copyToClipboard(revision.spec, 'Revision spec') },
  ]);
}
