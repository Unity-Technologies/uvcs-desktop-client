import type { PendingChange } from '@shared/domain/pendingChanges';
import type { StatusTone } from '../../components/StatusBadge';
import { categoryOf, type ChangeCategory } from './changeCategories';

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
