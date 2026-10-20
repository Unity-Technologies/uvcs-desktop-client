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

/**
 * `incoming`: what the query holds; `pending`: it has never answered; `failed`: its last read failed. A read that
 * fails after one that answered (a refresh, a focus) keeps what that one read (`incomingRefreshFailed` says so in the
 * header): only with nothing read does the error take the body.
 */
export function incomingViewState(incoming: IncomingChanges | undefined, pending: boolean, failed: boolean): IncomingViewState {
  if (!incoming) return pending || !failed ? { kind: 'reading' } : { kind: 'failed' };
  if (!incoming.branch) return { kind: 'notOnBranch' };
  return incoming.changesetCount === 0 ? { kind: 'upToDate' } : { kind: 'incoming', incoming };
}

/**
 * Whether the header says the last check failed: it did, and the view keeps what an earlier one read
 * (`incomingViewState`), which may be out of date. With nothing read, the failure takes the view instead.
 */
export function incomingRefreshFailed(incoming: IncomingChanges | undefined, failed: boolean): boolean {
  return failed && incoming !== undefined;
}
