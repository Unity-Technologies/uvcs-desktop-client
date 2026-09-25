import { ArrowRightLeft, Copy, FileDiff, FolderTree, GitBranchPlus, GitCompareArrows, GitMerge, GitPullRequestArrow, Pencil, Trash2 } from 'lucide-react';
import type { Label } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { mergeTo } from '../branches/branchOperations';
import {
  browseLabel,
  createBranchFromLabel,
  deleteLabels,
  diffLabels,
  diffWithAnotherLabel,
  mergeFromLabel,
  renameLabel,
  showLabelChanges,
  switchToLabel,
} from './labelOperations';

export function labelMenu(workspacePath: string, labels: Label[]): MenuEntry[] {
  if (labels.length === 0) return [];
  const single = labels.length === 1 ? labels[0]! : null;
  const pair = labels.length === 2 ? ([labels[0]!, labels[1]!] as const) : null;

  return tidyMenu([
    single && { id: 'switch', label: 'Switch to this label', icon: ArrowRightLeft, run: () => void switchToLabel(workspacePath, single) },
    single && { id: 'branch', label: 'New branch from label…', icon: GitBranchPlus, run: () => createBranchFromLabel(workspacePath, single) },
    SEPARATOR,
    single && { id: 'merge', label: 'Merge into workspace', icon: GitMerge, run: () => mergeFromLabel(single) },
    single && { id: 'mergeTo', label: 'Merge to…', icon: GitPullRequestArrow, run: () => void mergeTo(spec.label(single.name), single.name) },
    SEPARATOR,
    single && { id: 'changes', label: 'Show labeled changeset', icon: FileDiff, run: () => showLabelChanges(single) },
    single && { id: 'diffWith', label: 'Compare with another label…', icon: GitCompareArrows, run: () => void diffWithAnotherLabel(single) },
    pair && { id: 'diffPair', label: 'Compare selected labels', icon: GitCompareArrows, run: () => diffLabels(pair[0], pair[1]) },
    single && { id: 'browse', label: 'Browse files at this label', icon: FolderTree, run: () => browseLabel(single) },
    SEPARATOR,
    single && { id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameLabel(workspacePath, single) },
    single && { id: 'copy', label: 'Copy name', icon: Copy, run: () => copyToClipboard(single.name, 'Label name') },
    SEPARATOR,
    {
      id: 'delete',
      label: single ? 'Delete…' : `Delete ${labels.length} labels…`,
      icon: Trash2,
      danger: true,
      run: () => void deleteLabels(workspacePath, labels),
    },
  ]);
}
