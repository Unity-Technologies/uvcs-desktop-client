import type { IssueTrackerKind, TrackerConnection } from '../domain/issueTrackers';

/** A GitHub repository's owner (`acme` of `acme/game`), lower case as GitHub compares it. */
export function ownerOf(project: string): string {
  return project.split('/')[0]!.toLowerCase();
}

/** Whether a connection signs in to a project of `kind` on `server`: GitHub's covers its owner, or every owner (`*`). */
export function covers(connection: Pick<TrackerConnection, 'kind' | 'server' | 'scope'>, kind: IssueTrackerKind, server: string, project: string): boolean {
  if (connection.kind !== kind || connection.server.toLowerCase() !== server.toLowerCase()) return false;
  return kind !== 'github' || connection.scope === '*' || connection.scope === ownerOf(project);
}

/**
 * The connection that already signs in to a project, so another repository reuses it (docs/features/issue-trackers.md,
 * "One connection per"): on GitHub, the project's owner's first, then one for every owner.
 */
export function coveringConnection<Connection extends Pick<TrackerConnection, 'kind' | 'server' | 'scope'>>(
  connections: readonly Connection[],
  kind: IssueTrackerKind,
  server: string,
  project: string,
): Connection | undefined {
  const covering = connections.filter((connection) => covers(connection, kind, server, project));
  return covering.find((connection) => connection.scope !== '*') ?? covering[0];
}

/** The trackers' own hosts: github.com, GitHub's data residency hosts, Jira Cloud's sites. */
const TRACKER_HOSTS = /^(github\.com|[a-z0-9-]+\.ghe\.com|[a-z0-9-]+\.atlassian\.net|[a-z0-9-]+\.jira\.com)$/i;

/**
 * Whether main asks the user before a credential first goes to `server` (docs/features/issue-trackers.md, "Host
 * consent"): any address shaped like an issue on another host reads as GitHub Enterprise Server, so a window could name
 * one of its choosing. The trackers' own hosts, and a server a connection already signs in to, need no asking.
 */
export function needsHostConsent(server: string, connections: readonly Pick<TrackerConnection, 'server'>[]): boolean {
  if (TRACKER_HOSTS.test(new URL(server).hostname)) return false;
  return !connections.some((connection) => connection.server.toLowerCase() === server.toLowerCase());
}
