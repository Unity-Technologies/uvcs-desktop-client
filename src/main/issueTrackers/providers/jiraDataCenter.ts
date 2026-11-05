import type { IssueRead } from '@shared/domain/issueTrackers';
import type { ConnectionHttp } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import { isRecord, numberOf, okJson, stringOf, type IssueTrackerProvider } from './IssueTrackerProvider';
import { JIRA_ISSUE_FIELDS, jiraAccount, jiraIssueReads, jqlString } from './jiraIssues';

/**
 * The longest search address sent: proxies and servers refuse a request line past about 8 KB, and a server's own
 * address and Tomcat's headers count too. 100 keys of a usual length (`VCS-1009081`) take about 2.5 KB.
 */
export const MAX_SEARCH_URL_LENGTH = 6_000;

/**
 * Jira Data Center, self-hosted, through its REST API v2 at the server (its context path included): a personal access
 * token as Bearer (Jira's own, or an app's such as resolution's API Token Authentication). Every request is a GET: a
 * read-only token allows nothing else. Issues are read with one search (`key in (…)`, `searchUrls`), with
 * `validateQuery=false`: Data Center's `validateQuery` is a boolean (Cloud's `warn` is a 400 there), and its default
 * fails the whole search on one key that doesn't exist, where `false` leaves that key out (`missing`). An SSO server
 * sends a refused token to its login page: a 302 that `TrackerHttp` reads as a refused sign-in (`toLogin`).
 */
export const jiraDataCenterProvider: IssueTrackerProvider = {
  kind: 'jiraDataCenter',

  origins: (server) => [new URL(server).origin],

  authorization: ({ token }) => `Bearer ${token}`,

  async signIn(http, server) {
    return { account: await whoAmI(http, server) };
  },

  whoAmI: (http, connection) => whoAmI(http, connection.server),

  async projectAccess(http, connection, project) {
    const found = okJson(await http.send({ method: 'GET', url: `${connection.server}/rest/api/2/project/${encodeURIComponent(project)}` }), `Project ${project}`);
    const open = `project = ${jqlString(project)} AND statusCategory != Done`;
    const [openIssues, assignedToYou] = await Promise.all([countOf(http, connection.server, open), countOf(http, connection.server, `${open} AND assignee = currentUser()`)]);
    return { project, name: stringOf(found.name) ?? project, ...(openIssues !== undefined && { openIssues }), ...(assignedToYou !== undefined && { assignedToYou }) };
  },

  async readIssues(http, connection, keys) {
    const reads: IssueRead[] = [];
    for (const { url, keys: searched } of searches(connection.server, keys)) {
      reads.push(...jiraIssueReads(okJson(await http.send({ method: 'GET', url }), 'Jira'), searched, connection.server));
    }
    return reads;
  },
};

/** The addresses that search `keys`: one, unless the keys are too long for one address (`MAX_SEARCH_URL_LENGTH`). */
export function searchUrls(server: string, keys: readonly string[]): string[] {
  return searches(server, keys).map((search) => search.url);
}

function searches(server: string, keys: readonly string[]): { url: string; keys: string[] }[] {
  const found: { url: string; keys: string[] }[] = [];
  let batch: string[] = [];
  for (const key of keys) {
    if (batch.length > 0 && keysSearchUrl(server, [...batch, key]).length > MAX_SEARCH_URL_LENGTH) {
      found.push({ url: keysSearchUrl(server, batch), keys: batch });
      batch = [];
    }
    batch.push(key);
  }
  if (batch.length > 0) found.push({ url: keysSearchUrl(server, batch), keys: batch });
  return found;
}

function keysSearchUrl(server: string, keys: readonly string[]): string {
  return searchUrl(server, { jql: `key in (${keys.map(jqlString).join(', ')})`, fields: JIRA_ISSUE_FIELDS.join(','), maxResults: String(keys.length), validateQuery: 'false' });
}

function searchUrl(server: string, params: Record<string, string>): string {
  return `${server}/rest/api/2/search?${new URLSearchParams(params).toString()}`;
}

async function whoAmI(http: ConnectionHttp, server: string) {
  const account = jiraAccount(okJson(await http.send({ method: 'GET', url: `${server}/rest/api/2/myself` }), 'Jira'));
  if (!account) throw new TrackerError('unexpected', 'Jira answered no account');
  return account;
}

/** A JQL's count (a search's `total` with no issues); none when Jira won't count (the proof shows the name alone). */
async function countOf(http: ConnectionHttp, server: string, jql: string): Promise<number | undefined> {
  try {
    const response = await http.send({ method: 'GET', url: searchUrl(server, { jql, maxResults: '0' }) });
    return isRecord(response.body) && response.status === 200 ? numberOf(response.body.total) : undefined;
  } catch (error) {
    if (error instanceof TrackerError && error.reason !== 'unexpected') throw error;
    return undefined;
  }
}
