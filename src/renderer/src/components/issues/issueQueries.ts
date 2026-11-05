import { queryOptions } from '@tanstack/react-query';
import type { IssueRead, IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { api } from '../../api/client';
import { UNREADABLE_RETRY_MS } from '../comments/remoteObjects';
import { IssueReadBatch } from './IssueReadBatch';

/** An issue read stays fresh this long: five minutes, as the app's slow-changing lists. */
export const ISSUE_FRESH_MS = 5 * 60_000;

export const issueKeys = {
  setup: ['issueTrackers'] as const,
  /** Every issue of a connection, which its sign-in changing reads again. */
  ofConnection: (connectionId: string) => ['issue', connectionId] as const,
  issue: (connectionId: string, key: string) => ['issue', connectionId, key] as const,
  /** The `#` searches, by repository and words (`issueSearchQuery`). */
  searches: ['issueSearch'] as const,
};

/**
 * How long a read stays fresh (docs/features/issue-trackers.md, "Cached"): five minutes, a missing issue as a found
 * one; a failure until it may be tried again, `UNREADABLE_RETRY_MS` or the end of the tracker's rate limit, if sooner.
 */
export function issueStaleTime(read: IssueRead | undefined, now: number): number {
  if (read?.kind !== 'unreadable') return ISSUE_FRESH_MS;
  return read.retryAt === undefined ? UNREADABLE_RETRY_MS : Math.max(0, Math.min(UNREADABLE_RETRY_MS, read.retryAt - now));
}

const batch = new IssueReadBatch((connectionId, keys) => api.issueTrackers.readIssues(connectionId, keys));

/**
 * One issue, read through the batch with every other asked in the same task. Focus reads it again only on screen and
 * once stale; never on a timer or a reconnect, and never retried: the tracker's rate limit says when (`ISSUE_QUERY`).
 */
export function issueQuery(connectionId: string, key: string) {
  return queryOptions({
    queryKey: issueKeys.issue(connectionId, key),
    queryFn: () => batch.read(connectionId, key),
    staleTime: (query) => issueStaleTime(query.state.data, Date.now()),
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
    retry: false,
  });
}

export const issueTrackerSetupQuery = queryOptions({
  queryKey: issueKeys.setup,
  queryFn: () => api.issueTrackers.setup(),
  // Kept in step by `issueTrackersChanged`, never read again by itself.
  staleTime: Infinity,
});

/** The connections whose sign-in changed (signed in again, refused, signed out): their issues are read again. */
export function connectionsToReread(before: IssueTrackerSetup | undefined, after: IssueTrackerSetup): string[] {
  const credentials = new Map((before?.connections ?? []).map((connection) => [connection.id, credentialOf(connection)]));
  return after.connections.filter((connection) => credentials.has(connection.id) && credentials.get(connection.id) !== credentialOf(connection)).map((connection) => connection.id);
}

function credentialOf(connection: TrackerConnection): string {
  return `${connection.credential}:${connection.account.id}`;
}
