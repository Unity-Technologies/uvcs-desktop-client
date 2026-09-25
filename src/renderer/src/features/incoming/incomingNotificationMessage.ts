import type { Changeset } from '@shared/domain/changeset';
import { firstLine } from '../../lib/text';
import { displayName } from '../../lib/userName';

/** "Ana checked in 'Fix boost' on /main/t1", about the newest of `count` changesets that just came in. */
export function incomingNotificationMessage(newest: Pick<Changeset, 'owner' | 'comment'>, branch: string, count: number): string {
  const comment = firstLine(newest.comment);
  const what = comment ? ` '${comment}'` : '';
  const others = count > 1 ? ` (and ${count - 1} more)` : '';
  return `${displayName(newest.owner)} checked in${what} on ${branch}${others}`;
}
