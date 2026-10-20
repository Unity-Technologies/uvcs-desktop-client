import type { BranchIncomingChanges, IncomingChanges } from '@shared/domain/incoming';

/**
 * What the Incoming view shows under its header: the panes' skeleton while it reads, why it couldn't check, that the
 * workspace isn't on a branch (nothing comes in), that it is up to date, or the incoming changesets and files.
 */
export type IncomingViewState =
  | { kind: 'reading' }
  | { kind: 'failed' }
  | { kind: 'notOnBranch' }
  | { kind: 'upToDate' }
  | { kind: 'incoming'; incoming: BranchIncomingChanges };

/** `incoming`: what the query holds; `pending`: it has never answered; `failed`: its last read failed. */
export function incomingViewState(incoming: IncomingChanges | undefined, pending: boolean, failed: boolean): IncomingViewState {
  if (pending) return { kind: 'reading' };
  if (failed || !incoming) return { kind: 'failed' };
  if (!incoming.branch) return { kind: 'notOnBranch' };
  return incoming.changesetCount === 0 ? { kind: 'upToDate' } : { kind: 'incoming', incoming };
}
