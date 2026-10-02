import type { LabelInfo } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, type MenuPlace } from '../../components/menuWords';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { mergeTo } from '../branches/branchOperations';
import { openObjectPermissions } from '../permissions/openPermissions';
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

/** What a label is copied as, first what ⌘C copies: `v1.0`, `lb:v1.0`, `lb:v1.0@repo@server`, its comment. */
export function labelCopyTexts(label: Pick<LabelInfo, 'name' | 'comment' | 'repository'>): CopyTexts {
  return {
    name: label.name,
    spec: spec.label(label.name),
    fullSpec: label.repository && `${spec.label(label.name)}@${label.repository}`,
    comment: label.comment.trim(),
  };
}

/** The menu of the selected labels, the same wherever labels show: the Labels view, the Branch Explorer, the top bar, the palette and their details. */
export function labelMenu(workspacePath: string, labels: LabelInfo[], place: MenuPlace = {}): MenuEntry[] {
  if (labels.length === 0) return [];
  const single = labels.length === 1 ? labels[0]! : null;
  const pair = labels.length === 2 ? ([labels[0]!, labels[1]!] as const) : null;

  return groupedMenu([
    single && menuAction('diff', () => showLabelChanges(single)),
    pair && menuAction('diffPair', () => diffLabels(pair[0], pair[1])),
    single && menuAction('switch', () => void switchToLabel(workspacePath, single), { label: 'Switch to this label' }),
    single && menuAction('merge', () => mergeFromLabel(single)),
    single && menuAction('mergeTo', () => void mergeTo(spec.label(single.name), single.name)),
    single && menuAction('newBranch', () => void createBranchFromLabel(workspacePath, single).then((name) => name && place.onBranchCreated?.(name))),
    single && menuAction('compare', () => void diffWithAnotherLabel(single)),
    single && menuAction('browse', () => browseLabel(single), { label: 'Browse repository at this label' }),
    single &&
      !place.inBranchExplorer &&
      menuAction('showInBranchExplorer', () => showInBranchExplorer({ kind: 'label', name: single.name, changeset: single.changeset, date: single.date })),
    single && copySubmenu('Label', labelCopyTexts(single), { shortcut: hotkey('listCopy') }),
    single && menuAction('rename', () => void renameLabel(workspacePath, single), { shortcut: hotkey('rename') }),
    single && menuAction('permissions', () => openObjectPermissions(workspacePath, 'label', single)),
    menuAction('delete', () => void deleteLabels(workspacePath, labels), single ? {} : { label: `Delete ${labels.length} labels…` }),
  ]);
}
