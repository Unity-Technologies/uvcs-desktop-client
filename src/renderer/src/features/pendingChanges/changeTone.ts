import type { PendingChange } from '@shared/domain/pendingChanges';
import { statusTones } from '../../components/changeFilter';
import type { ItemPresence } from '../../components/ItemRow';
import type { StatusMark } from '../../components/ItemStatusMark';
import type { StatusTone } from '../../components/StatusBadge';
import { categoryOf, describeKindList, describeKinds, isContentKind, isMovedAndChanged, type ChangeCategory } from './changeCategories';

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

/** The statuses the filter chips find a pending change by: a moved file that changed by C and M. */
export function changeTones(change: PendingChange): readonly StatusTone[] {
  return statusTones(changeTone(change), isMovedAndChanged(change));
}

/**
 * The status letter of a pending change, and what it means for its tooltip. A moved file that changed gets a C before
 * its M, each letter's tooltip naming its own kinds ("Changed"; "Checked out, Moved").
 */
export function changeStatus(change: PendingChange): StatusMark {
  if (!isMovedAndChanged(change)) return { tone: changeTone(change), label: describeKinds(change) };
  return {
    tone: 'moved',
    label: describeKindList(change.kinds.filter((kind) => !isContentKind(kind))),
    changedLabel: describeKindList(change.kinds.filter(isContentKind)),
  };
}

/** Private items step back on their rows as in Files, ignored and cloaked ones further; a hidden change is controlled. */
export function changePresence(change: PendingChange): ItemPresence {
  const category = categoryOf(change);
  if (category === 'private') return 'private';
  return category === 'ignored' || category === 'cloaked' ? 'ignored' : 'controlled';
}
