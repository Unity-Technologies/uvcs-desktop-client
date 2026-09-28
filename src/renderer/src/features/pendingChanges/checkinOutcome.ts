import { isUnchangedCheckout, type CheckinResult, type PendingChange } from '@shared/domain/pendingChanges';
import type { OperationSuccess } from '../../app/operations/runOperation';
import { pluralize } from '../../lib/text';

/**
 * Checks what a checkin of `changes` did. No changeset is fine when every change was a checkout without edits: `cm`
 * released them and had nothing left to record. With any other change in, no changeset is a failure.
 */
export function expectedCheckinResult(result: CheckinResult, changes: PendingChange[]): CheckinResult {
  if (result.kind === 'noChanges' && !changes.every(isUnchangedCheckout)) {
    throw new Error('The checkin finished but no changeset was created.');
  }
  return result;
}

/** The quiet note of a checkin that only released checkouts without edits. */
export function releasedCheckoutsNote(count: number): OperationSuccess {
  return { kind: 'info', title: 'Nothing to check in', detail: `Released ${pluralize(count, 'checkout')} without edits.` };
}
