import type { IssueTrackerKind, TrackerConnection } from '../domain/issueTrackers';
import { isGitHubCloud } from './grammars/github';
import { isJiraCloudHost } from './grammars/jiraCloud';

/** Whether a connection's credential needs signing in again: refused by the tracker, or gone from this computer. */
export function needsSignIn(connection: Pick<TrackerConnection, 'credential'>): boolean {
  return connection.credential === 'refused' || connection.credential === 'missing';
}

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

/**
 * Whether main asks the user before a credential first goes to `server` (docs/features/issue-trackers.md, "Host
 * consent"): any address shaped like an issue on another host reads as GitHub Enterprise Server, so a window could name
 * one of its choosing. The trackers' own hosts, and a server a connection already signs in to, need no asking.
 */
export function needsHostConsent(server: string, connections: readonly Pick<TrackerConnection, 'server'>[]): boolean {
  // The trackers' own hosts, as their grammars read them: github.com and its data residency hosts, Jira Cloud's sites.
  if (isGitHubCloud(server) || isJiraCloudHost(new URL(server).hostname)) return false;
  return !connections.some((connection) => connection.server.toLowerCase() === server.toLowerCase());
}
