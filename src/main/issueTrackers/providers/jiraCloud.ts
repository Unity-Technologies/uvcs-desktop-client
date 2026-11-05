import type { ProjectAccess } from '@shared/domain/issueTrackers';
import type { ConnectionHttp } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import { isRecord, numberOf, okJson, stringOf, type IssueTrackerProvider, type ProviderConnection } from './IssueTrackerProvider';
import { JIRA_ISSUE_FIELDS, jiraAccount, jiraIssueReads } from './jiraIssues';

/** Atlassian's gateway: a scoped API token works only through it (`/ex/jira/<cloudId>`), never at the site. */
const ATLASSIAN_GATEWAY = 'https://api.atlassian.com';

/** Where the connection's REST API is: the base its token answered on, the site by default. */
function apiOf(connection: ProviderConnection): string {
  return connection.apiBase ?? connection.server;
}

/** A project key goes into JQL quoted; a key is letters, digits and `_`, but the quotes keep it a value whatever it is. */
function jqlString(value: string): string {
  return `"${value.replace(/["\\]/g, (mark) => `\\${mark}`)}"`;
}

export const jiraCloudProvider: IssueTrackerProvider = {
  kind: 'jiraCloud',

  origins: (server) => [server, ATLASSIAN_GATEWAY],

  authorization: ({ token, email }) => `Basic ${Buffer.from(`${email ?? ''}:${token}`).toString('base64')}`,

  async signIn(http, server) {
    try {
      return { account: await whoAmIAt(http, server) };
    } catch (error) {
      if (!(error instanceof TrackerError) || error.reason !== 'signInRefused') throw error;
    }
    // A scoped token: the site refuses it, Atlassian's gateway takes it, by the site's cloud id.
    const tenant = okJson(await http.send({ method: 'GET', url: `${server}/_edge/tenant_info` }), 'The site');
    const cloudId = stringOf(tenant.cloudId);
    if (!cloudId) throw new TrackerError('signInRefused', `${new URL(server).host} refused the sign-in`);
    const apiBase = `${ATLASSIAN_GATEWAY}/ex/jira/${cloudId}`;
    return { account: await whoAmIAt(http, apiBase), apiBase };
  },

  whoAmI: (http, connection) => whoAmIAt(http, apiOf(connection)),

  async projectAccess(http, connection, project) {
    const api = apiOf(connection);
    const found = okJson(await http.send({ method: 'GET', url: `${api}/rest/api/3/project/${encodeURIComponent(project)}` }), `Project ${project}`);
    const access: ProjectAccess = { project, name: stringOf(found.name) ?? project };
    const open = `project = ${jqlString(project)} AND statusCategory != Done`;
    const [openIssues, assignedToYou] = await Promise.all([countOf(http, api, open), countOf(http, api, `${open} AND assignee = currentUser()`)]);
    return { ...access, ...(openIssues !== undefined && { openIssues }), ...(assignedToYou !== undefined && { assignedToYou }) };
  },

  async readIssues(http, connection, keys) {
    const response = await http.send({ method: 'POST', url: `${apiOf(connection)}/rest/api/3/issue/bulkfetch`, json: { issueIdsOrKeys: keys, fields: JIRA_ISSUE_FIELDS } });
    return jiraIssueReads(okJson(response, 'Jira'), keys, connection.server);
  },
};

async function whoAmIAt(http: ConnectionHttp, api: string) {
  const account = jiraAccount(okJson(await http.send({ method: 'GET', url: `${api}/rest/api/3/myself` }), 'Jira'));
  if (!account) throw new TrackerError('unexpected', 'Jira answered no account');
  return account;
}

/** A JQL's count, approximate as Jira gives it at once; none when Jira won't count (the proof shows the name alone). */
async function countOf(http: ConnectionHttp, api: string, jql: string): Promise<number | undefined> {
  try {
    const response = await http.send({ method: 'POST', url: `${api}/rest/api/3/search/approximate-count`, json: { jql } });
    return isRecord(response.body) && response.status === 200 ? numberOf(response.body.count) : undefined;
  } catch (error) {
    if (error instanceof TrackerError && error.reason !== 'unexpected') throw error;
    return undefined;
  }
}
