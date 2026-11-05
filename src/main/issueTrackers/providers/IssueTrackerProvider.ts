import type { Issue, IssueRead, IssueSearch, IssueTrackerKind, ProjectAccess, TrackerAccount } from '@shared/domain/issueTrackers';
import type { ConnectionHttp, TrackerResponse } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import type { TrackerCredential } from '../TrackerSecrets';

/** Where a connection's API is: its server, and for Jira Cloud the base its token answered on. */
export interface ProviderConnection {
  server: string;
  apiBase?: string;
}

/** Who a credential signed in as, and what the connection keeps of it. */
export interface SignedIn {
  account: TrackerAccount;
  /** Jira Cloud: the site, or Atlassian's gateway for a scoped token. */
  apiBase?: string;
}

/**
 * A tracker's calls (docs/features/issue-trackers.md, "The provider"). It never holds a secret: the `ConnectionHttp`
 * it's handed adds the credential, and sends only to `origins`.
 */
export interface IssueTrackerProvider {
  kind: IssueTrackerKind;
  /** The origins a connection's credential may go to: its server and its API's hosts. */
  origins(server: string): string[];
  /** The `Authorization` header of a credential. */
  authorization(credential: TrackerCredential): string;
  /** Signs in with the credential `http` carries: who it is, and where its API answered. */
  signIn(http: ConnectionHttp, server: string): Promise<SignedIn>;
  /** The account the credential belongs to, as it is now. */
  whoAmI(http: ConnectionHttp, connection: ProviderConnection): Promise<TrackerAccount>;
  /** Proof that a project can be read, with its counts where the tracker gives them. */
  projectAccess(http: ConnectionHttp, connection: ProviderConnection, project: string): Promise<ProjectAccess>;
  /** The issues named, one request for all of them (at most `MAX_KEYS_PER_READ`). */
  readIssues(http: ConnectionHttp, connection: ProviderConnection, keys: readonly string[]): Promise<IssueRead[]>;
  /** The bound projects' issues a `#` search finds (`IssueSearch`), at most `ISSUE_SEARCH_LIMIT`, in one request. */
  searchIssues(http: ConnectionHttp, connection: ProviderConnection, projects: readonly string[], search: IssueSearch): Promise<Issue[]>;
}

/** The most issues a search answers: more than a suggestion list shows, so typing narrows them without asking again. */
export const ISSUE_SEARCH_LIMIT = 20;

/** The most keys one request reads: Jira's `bulkfetch` takes 100, and GitHub's GraphQL as many aliases at ease. */
export const MAX_KEYS_PER_READ = 100;

/** A server whose answer says it isn't the tracker its link looked like (an older GitLab read as GitHub Enterprise Server). */
export class NotThisTrackerError extends TrackerError {
  constructor(server: string) {
    super('unexpected', `${server} doesn't answer as this tracker`);
  }
}

/** An answer's JSON when it succeeded; a 403 or 404 is no access, anything else unexpected. */
export function okJson(response: TrackerResponse, where: string): Record<string, unknown> {
  if (response.status >= 200 && response.status < 300 && isRecord(response.body)) return response.body;
  if (response.status === 403 || response.status === 404) throw new TrackerError('noAccess', `${where} can't be read with this sign-in`);
  throw new TrackerError('unexpected', `${where} answered ${response.status}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
