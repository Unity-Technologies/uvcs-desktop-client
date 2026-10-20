import type { Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { withoutAction, type MenuEntry } from '../../lib/actions';
import { myShelves } from './myShelves';
import { shelveMenu } from './shelveMenu';

interface ShelveDiffMenuOptions {
  /** This app's records of the shelves it left (`switchShelves`). */
  records: SwitchShelveRecord[];
  /** The user, to tell their shelves from others' (unknown: none are theirs). */
  me: string | undefined;
  onApplied: () => void;
  onDeleted: () => void;
}

export interface ShelveDiffMenu {
  /** Changes a switch or an update left: the page's button restores them (applies, then deletes the shelve). */
  left: boolean;
  /** The rest of the shelve's menu, behind "More actions": the page is its diff, and its button applies it. */
  menu: MenuEntry[];
}

/**
 * What a shelve's diff offers: someone else's shelve is only applied, never deleted or restored from here. Opening
 * its diff, here or in a new window, is the page's own (its breadcrumb moves it to a new window).
 */
export function shelveDiffMenu(workspacePath: string, shelve: Shelve, { records, me, onApplied, onDeleted }: ShelveDiffMenuOptions): ShelveDiffMenu {
  const { left, mine } = myShelves([shelve], records, { everyone: true, me })[0]!;
  const menu = shelveMenu(workspacePath, [shelve], { left, mine, onApplied, onDeleted });
  return { left, menu: ['diff', 'diffInNewWindow', 'apply'].reduce(withoutAction, menu) };
}
