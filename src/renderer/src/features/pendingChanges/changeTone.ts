import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ItemPresence } from '../../components/ItemRow';
import type { StatusTone } from '../../components/StatusBadge';
import { categoryOf, describeKinds, type ChangeCategory } from './changeCategories';

const TONES: Record<ChangeCategory, StatusTone> = {
  changed: 'changed',
  added: 'added',
  deleted: 'deleted',
  moved: 'moved',
  private: 'private',
  ignored: 'muted',
  cloaked: 'muted',
  hidden: 'muted',
};

export function changeTone(change: PendingChange): StatusTone {
  return TONES[categoryOf(change)];
}

/** The status letter of a pending change, and what it means for its tooltip. */
export function changeStatus(change: PendingChange): { tone: StatusTone; label: string } {
  return { tone: changeTone(change), label: describeKinds(change) };
}

/** Private items step back on their rows as in Files, ignored and cloaked ones further; a hidden change is controlled. */
export function changePresence(change: PendingChange): ItemPresence {
  const category = categoryOf(change);
  if (category === 'private') return 'private';
  return category === 'ignored' || category === 'cloaked' ? 'ignored' : 'controlled';
}
