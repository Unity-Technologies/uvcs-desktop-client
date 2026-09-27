import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

/** What a shelve is copied as, first what ⌘C copies: `3`, `sh:3`, `sh:3@repo@server`, its comment and GUID. */
export function shelveCopyTexts(shelve: ShelveInfo): CopyTexts {
  return {
    number: String(shelve.id),
    spec: spec.shelve(shelve.id),
    fullSpec: shelve.repository && `${spec.shelve(shelve.id)}@${shelve.repository}`,
    comment: shelve.comment.trim(),
    guid: shelve.guid,
  };
}

/** A shelve as lists know it, or as the top bar does when the workspace is on it (its GUID unread). */
export type ShelveInfo = Pick<Shelve, 'id' | 'comment' | 'repository'> & Partial<Pick<Shelve, 'guid'>>;

interface ShelveMenuOptions {
  /** Changes a switch or an update left, which are restored (applied, then deleted) rather than applied. */
  left?: boolean;
  /** `false` for someone else's, which Changes applies without deleting and never deletes. */
  mine?: boolean;
  /** What follows applying it or deleting it, e.g. leaving its diff. */
  onApplied?: () => void;
  onDeleted?: () => void;
}

/** The menu of a shelve, the same wherever shelves show: the Shelves view, Changes' shelves, a shelve's diff, the palette and its details. */
export function shelveMenu(workspacePath: string, shelves: ShelveInfo[], { left = false, mine = true, onApplied, onDeleted }: ShelveMenuOptions = {}): MenuEntry[] {
  if (shelves.length !== 1) return [];
  const shelve = shelves[0]!;
  const apply = async (andDelete: boolean): Promise<void> => {
    if ((await applyShelve(workspacePath, shelve.id, andDelete)) && onApplied) onApplied();
  };

  return groupedMenu([
    menuAction('diff', () => showShelveChanges(shelve)),
    menuAction('apply', () => void apply(left), { label: left ? 'Restore' : 'Apply to workspace' }),
    !left && mine && menuAction('applyAndDelete', () => void apply(true)),
    menuAction('newCodeReview', () =>
      openCreateCodeReviewDialog(workspacePath, { kind: 'shelve', value: String(shelve.id), title: shelve.comment.split('\n')[0] }),
    ),
    copySubmenu('Shelve', shelveCopyTexts(shelve), { shortcut: hotkey('listCopy') }),
    mine &&
      menuAction('delete', async () => {
        if ((await deleteShelve(workspacePath, shelve.id)) && onDeleted) onDeleted();
      }),
  ]);
}
