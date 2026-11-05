import type { ConnectionHttp } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import { isRecord, numberOf, okJson, stringOf, type IssueTrackerProvider } from './IssueTrackerProvider';
import { JIRA_ISSUE_FIELDS, jiraAccount, jiraIssueReads, jqlString } from './jiraIssues';

/**
 * Jira Data Center, self-hosted, through its REST API v2 at the server (its context path included): a personal access
 * token as Bearer; issues read with one search (`key in (…)`), a key that doesn't exist only warning
 * (`validateQuery: warn`), so the others still read. An SSO server sends a refused token to its login page: a 302 that
 * `TrackerHttp` reads as a refused sign-in (`toLogin`).
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
    const jql = `key in (${keys.map(jqlString).join(', ')})`;
    const response = await http.send({ method: 'POST', url: `${connection.server}/rest/api/2/search`, json: { jql, fields: JIRA_ISSUE_FIELDS, maxResults: keys.length, validateQuery: 'warn' } });
    return jiraIssueReads(okJson(response, 'Jira'), keys, connection.server);
  },
};

async function whoAmI(http: ConnectionHttp, server: string) {
  const account = jiraAccount(okJson(await http.send({ method: 'GET', url: `${server}/rest/api/2/myself` }), 'Jira'));
  if (!account) throw new TrackerError('unexpected', 'Jira answered no account');
  return account;
}

/** A JQL's count (a search's `total` with no issues); none when Jira won't count (the proof shows the name alone). */
async function countOf(http: ConnectionHttp, server: string, jql: string): Promise<number | undefined> {
  try {
    const response = await http.send({ method: 'POST', url: `${server}/rest/api/2/search`, json: { jql, maxResults: 0 } });
    return isRecord(response.body) && response.status === 200 ? numberOf(response.body.total) : undefined;
  } catch (error) {
    if (error instanceof TrackerError && error.reason !== 'unexpected') throw error;
    return undefined;
  }
}
