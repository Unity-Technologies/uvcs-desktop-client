import type { TrackerAccount } from '@shared/domain/issueTrackers';
import { githubApiBase, githubGraphqlUrl, isGitHubCloud } from '@shared/issueTrackers/grammars/github';
import type { ConnectionHttp } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import { isRecord, MAX_KEYS_PER_READ, NotThisTrackerError, numberOf, okJson, stringOf, type IssueTrackerProvider } from './IssueTrackerProvider';
import { GITHUB_SEARCH, githubFoundIssues, githubIssueReads, githubIssuesQuery, graphqlErrors, isGraphqlRateLimited } from './githubIssues';
import { githubSearchQuery } from './issueSearchQueries';

export const githubProvider: IssueTrackerProvider = {
  kind: 'github',

  origins: (server) => [...new Set([new URL(server).origin, new URL(githubApiBase(server)).origin])],

  authorization: ({ token }) => `Bearer ${token}`,

  async signIn(http, server) {
    const response = await http.send({ method: 'GET', url: `${githubApiBase(server)}/user` });
    // A server that isn't GitHub Enterprise Server answers its `/api/v3` with a page, or not at all.
    if (!isGitHubCloud(server) && (response.status === 404 || !isRecord(response.body))) throw new NotThisTrackerError(server);
    return { account: githubAccount(okJson(response, 'GitHub')) };
  },

  async whoAmI(http, connection) {
    return githubAccount(okJson(await http.send({ method: 'GET', url: `${githubApiBase(connection.server)}/user` }), 'GitHub'));
  },

  async projectAccess(http, connection, project) {
    const [owner = '', name = ''] = project.split('/');
    const query = [
      'query Access($owner: String!, $name: String!, $assigned: String!) {',
      '  repository(owner: $owner, name: $name) { nameWithOwner issues(states: OPEN) { totalCount } }',
      '  search(type: ISSUE, query: $assigned, first: 1) { issueCount }',
      '}',
    ].join('\n');
    const variables = { owner, name, assigned: `repo:${owner}/${name} is:issue is:open assignee:@me` };
    const body = await graphql(http, connection.server, query, variables);
    const repository = isRecord(body.data) && isRecord(body.data.repository) ? body.data.repository : null;
    if (!repository) throw new TrackerError('noAccess', `${project} can't be read with this sign-in`);
    const issues = isRecord(repository.issues) ? numberOf(repository.issues.totalCount) : undefined;
    const search = isRecord(body.data) && isRecord(body.data.search) ? numberOf(body.data.search.issueCount) : undefined;
    return { project, name: stringOf(repository.nameWithOwner) ?? project, ...(issues !== undefined && { openIssues: issues }), ...(search !== undefined && { assignedToYou: search }) };
  },

  async readIssues(http, connection, keys) {
    const batch = githubIssuesQuery(keys.slice(0, MAX_KEYS_PER_READ));
    const body = await graphql(http, connection.server, batch.query, batch.variables);
    return githubIssueReads(body, batch, connection.server);
  },

  /** GraphQL's `search`, the query as a variable (`githubSearchQuery`): it counts against GitHub's search limit. */
  async searchIssues(http, connection, projects, search) {
    const body = await graphql(http, connection.server, GITHUB_SEARCH, { q: githubSearchQuery(projects, search) });
    return githubFoundIssues(body, connection.server);
  },
};

/**
 * A GraphQL request. GitHub says its rate limit with a 200 whose errors name `RATE_LIMITED`: the origin then rests as
 * for a 429, and the request fails as rate limited. Other errors are the answer's, read per alias.
 */
async function graphql(http: ConnectionHttp, server: string, query: string, variables: Record<string, string>): Promise<Record<string, unknown>> {
  const url = githubGraphqlUrl(server);
  const response = await http.send({ method: 'POST', url, json: { query, variables } });
  const body = okJson(response, 'GitHub');
  if (isGraphqlRateLimited(body)) {
    const until = http.restOrigin(url, response.header);
    throw new TrackerError('rateLimited', `${new URL(url).host} asked to wait`, until);
  }
  if (!isRecord(body.data) && graphqlErrors(body).length > 0) throw new TrackerError('unexpected', 'GitHub refused the query');
  return body;
}

function githubAccount(user: Record<string, unknown>): TrackerAccount {
  const login = stringOf(user.login) ?? '';
  return { id: login, name: stringOf(user.name) || login };
}
