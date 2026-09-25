import { AppWindow, Copy, Download, FileDiff, GitGraph, RotateCcw, ScanText } from 'lucide-react';
import type { ItemRevision } from '@shared/domain/history';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { fileNameOf } from '../../lib/text';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { openRevision, revertItemTo, saveRevisionAs } from './revisionOperations';

interface HistoryMenuContext {
  workspacePath: string;
  path: string;
}

export function historyMenu({ workspacePath, path }: HistoryMenuContext, selected: ItemRevision[]): MenuEntry[] {
  const revision = selected.length === 1 ? selected[0]! : null;
  const isFile = revision !== null && revision.itemType !== 'directory';
  const name = fileNameOf(path);

  return tidyMenu([
    revision && {
      id: 'changesetDiff',
      label: `Diff changeset ${revision.changesetId}`,
      icon: FileDiff,
      run: () => openChangesetDiff({ id: revision.changesetId }, path),
    },
    revision && {
      id: 'showInBranchExplorer',
      label: 'Show changeset in Branch Explorer',
      icon: GitGraph,
      run: () => showInBranchExplorer({ kind: 'changeset', id: revision.changesetId, date: revision.date }),
    },
    isFile && {
      id: 'annotate',
      label: 'Annotate this revision',
      icon: ScanText,
      run: () => navigation.openPage({ kind: 'annotate', path, revisionSpec: revision.spec }),
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
