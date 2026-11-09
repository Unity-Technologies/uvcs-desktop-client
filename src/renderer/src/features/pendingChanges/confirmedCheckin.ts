import type { PendingChange } from '@shared/domain/pendingChanges';
import { settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import type { BulkPrivate } from './bulkPrivate';
import { confirmBulkPrivateCheckin, confirmPulledIn } from './checkinConfirmations';
import { checkinChanges } from './checkinOperations';
import { checkinPathsOf } from './checkinPaths';
import { successCardTellsCheckin } from './successMoment';

/** Runs the check-in or shelve itself, once everything is confirmed: the caller shows it busy meanwhile. */
export type WhileRunning = <T>(run: () => Promise<T>) => Promise<T>;

export const justRun: WhileRunning = (run) => run();

/** A check-in whose comment is settled: what goes in, and what else is pending. */
export interface ConfirmedCheckin {
  workspacePath: string;
  /** The changes the user chose. */
  changes: PendingChange[];
  /** Every pending change: what a folder given to cm takes along, and whether nothing is left pending. */
  allChanges: PendingChange[];
  comment: string;
  /** A pile of private files among `changes`, asked about before they're added. */
  bulkPrivate: BulkPrivate | null;
  /** The incoming check saw the branch move on: the check-in updates first. */
  updateFirst?: boolean;
}

/**
 * The steps every check-in takes once its comment is settled, from the Changes panel or from Files: takes the files as
 * they are on disk (unsaved edits are saved first, or dropped, or it waits), asks about a pile of private files and
 * about the changes a folder takes along (`checkinPathsOf`), then checks in (`checkinChanges`). True once a changeset
 * is created.
 */
export async function checkinConfirmed(request: ConfirmedCheckin, whileRunning: WhileRunning = justRun): Promise<boolean> {
  if (!(await settleBeforeLeaving())) return false;
  if (request.bulkPrivate && !(await confirmBulkPrivateCheckin(request.bulkPrivate))) return false;
  const plan = checkinPathsOf(request.changes, request.allChanges);
  if (plan.pulledIn.length > 0 && !(await confirmPulledIn('checkin', plan))) return false;
  const changes = [...request.changes, ...plan.pulledIn];
  return whileRunning(() =>
    checkinChanges({
      workspacePath: request.workspacePath,
      changes,
      paths: plan.paths,
      addsPrivate: plan.addsPrivate,
      comment: request.comment,
      updateFirst: request.updateFirst,
      quiet: successCardTellsCheckin(changes, request.allChanges),
    }),
  );
}
