import { describe, expect, it } from 'vitest';
import { fakeTrackerHttp } from '../testing/fakeTrackerHttp';
import { TrackerError } from '../TrackerError';
import { jiraCloudProvider } from './jiraCloud';

const SITE = 'https://acme.atlassian.net';
const GATEWAY = 'https://api.atlassian.com/ex/jira/0c1d-cloud';

/** `GET /rest/api/3/myself`, as Jira Cloud answers it. */
const MYSELF = { accountId: '5b10ac8d82e05b22cc7d4ef5', emailAddress: 'ana@acme.com', displayName: 'Ana Díaz', active: true, timeZone: 'Europe/Madrid' };

/** `POST /rest/api/3/issue/bulkfetch`, as Jira Cloud answers it. */
const BULKFETCH = {
  expand: 'schema,names',
  issues: [
    {
      id: '10002',
      key: 'VCS-12',
      self: `${SITE}/rest/api/3/issue/10002`,
      fields: {
        summary: 'Keep the selection when the layout changes',
        status: { name: 'In Progress', id: '3', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
        issuetype: { name: 'Bug', subtask: false },
        assignee: { accountId: '5b10', displayName: 'Lena Marsh', emailAddress: 'lena@acme.com' },
      },
    },
    {
      id: '10003',
      key: 'VCS-13',
      fields: { summary: 'Won’t fix this', status: { name: "Won't Do", statusCategory: { key: 'done' } }, issuetype: { name: 'Task' }, assignee: null },
    },
  ],
  issueErrors: [],
};

function connected(answers: Parameters<typeof fakeTrackerHttp>[0]) {
  const tracker = fakeTrackerHttp(answers);
  return { tracker, http: tracker.http.bound(jiraCloudProvider.origins(SITE), jiraCloudProvider.authorization({ token: 't', email: 'ana@acme.com' })) };
}

describe('the Jira Cloud provider', () => {
  it('signs in with the email and token as Basic, at the site', async () => {
    const { tracker, http } = connected({ [`GET ${SITE}/rest/api/3/myself`]: { json: MYSELF } });
    expect(await jiraCloudProvider.signIn(http, SITE)).toEqual({ account: { id: '5b10ac8d82e05b22cc7d4ef5', name: 'Ana Díaz', email: 'ana@acme.com' } });
    expect(tracker.requests[0]!.headers.Authorization).toBe(`Basic ${Buffer.from('ana@acme.com:t').toString('base64')}`);
  });

  it('signs a scoped token in through Atlassian’s gateway, which the site refuses', async () => {
    const { tracker, http } = connected({
      [`GET ${SITE}/rest/api/3/myself`]: { status: 401 },
      [`GET ${SITE}/_edge/tenant_info`]: { json: { cloudId: '0c1d-cloud' } },
      [`GET ${GATEWAY}/rest/api/3/myself`]: { json: MYSELF },
    });
    expect(await jiraCloudProvider.signIn(http, SITE)).toMatchObject({ apiBase: GATEWAY });
    expect(tracker.lines()).toHaveLength(3);
  });

  it('fails a token both refuse as refused', async () => {
    const { http } = connected({
      [`GET ${SITE}/rest/api/3/myself`]: { status: 401 },
      [`GET ${SITE}/_edge/tenant_info`]: { json: { cloudId: '0c1d-cloud' } },
      [`GET ${GATEWAY}/rest/api/3/myself`]: { status: 401 },
    });
    await expect(jiraCloudProvider.signIn(http, SITE)).rejects.toMatchObject({ reason: 'signInRefused' });
  });

  it('proves a project with its name and its counts: four requests in all with the sign-in', async () => {
    const counts = (request: { json?: unknown }) => ({ json: { count: String((request.json as { jql: string }).jql).includes('currentUser') ? 6 : 214 } });
    const { tracker, http } = connected({ [`GET ${SITE}/rest/api/3/project/VCS`]: { json: { key: 'VCS', name: 'Version Control' } }, [`POST ${SITE}/rest/api/3/search/approximate-count`]: counts });
    expect(await jiraCloudProvider.projectAccess(http, { server: SITE }, 'VCS')).toEqual({ project: 'VCS', name: 'Version Control', openIssues: 214, assignedToYou: 6 });
    expect(tracker.requests.map((request) => request.json)).toEqual([undefined, { jql: 'project = "VCS" AND statusCategory != Done' }, { jql: 'project = "VCS" AND statusCategory != Done AND assignee = currentUser()' }]);
  });

  it('fails a project the account can’t see as no access', async () => {
    const { http } = connected({ [`GET ${SITE}/rest/api/3/project/VCS`]: { status: 404, json: { errorMessages: ["No project could be found with key 'VCS'."] } } });
    const error = await jiraCloudProvider.projectAccess(http, { server: SITE }, 'VCS').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackerError);
    expect(error).toMatchObject({ reason: 'noAccess' });
  });

  it('reads every key in one request, a missing one as missing, and maps the status categories', async () => {
    const { tracker, http } = connected({ [`POST ${SITE}/rest/api/3/issue/bulkfetch`]: { json: BULKFETCH } });
    const reads = await jiraCloudProvider.readIssues(http, { server: SITE }, ['VCS-12', 'VCS-13', 'VCS-99']);
    expect(reads).toEqual([
      {
        key: 'VCS-12',
        kind: 'found',
        issue: {
          key: 'VCS-12',
          title: 'Keep the selection when the layout changes',
          status: 'In Progress',
          statusCategory: 'inProgress',
          type: 'Bug',
          assignee: { id: '5b10', name: 'Lena Marsh', email: 'lena@acme.com' },
          url: `${SITE}/browse/VCS-12`,
        },
      },
      { key: 'VCS-13', kind: 'found', issue: expect.objectContaining({ status: "Won't Do", statusCategory: 'done', assignee: null }) },
      { key: 'VCS-99', kind: 'missing' },
    ]);
    expect(tracker.requests[0]!.json).toEqual({ issueIdsOrKeys: ['VCS-12', 'VCS-13', 'VCS-99'], fields: ['summary', 'status', 'issuetype', 'assignee'] });
  });

  it('takes the keys left out as unreadable when Jira lists issue errors', async () => {
    const { http } = connected({ [`POST ${SITE}/rest/api/3/issue/bulkfetch`]: { json: { issues: [], issueErrors: [{ id: '10009', errorMessage: 'Retry later' }] } } });
    expect(await jiraCloudProvider.readIssues(http, { server: SITE }, ['VCS-14'])).toEqual([{ key: 'VCS-14', kind: 'unreadable', reason: 'unexpected' }]);
  });

  it('reads through the gateway its token answered on, opening issues at the site', async () => {
    const { http } = connected({ [`POST ${GATEWAY}/rest/api/3/issue/bulkfetch`]: { json: BULKFETCH } });
    const [read] = await jiraCloudProvider.readIssues(http, { server: SITE, apiBase: GATEWAY }, ['VCS-12']);
    expect(read).toMatchObject({ issue: { url: `${SITE}/browse/VCS-12` } });
  });

  it('searches the bound projects with one JQL search, most recently updated first', async () => {
    // `POST /rest/api/3/search/jql`, as Jira Cloud answers it: no `total`, a `nextPageToken` when there's more.
    const { tracker, http } = connected({ [`POST ${SITE}/rest/api/3/search/jql`]: { json: { issues: BULKFETCH.issues, nextPageToken: 'Ch0jU3RyaW5nJlZrTlQ' } } });
    const issues = await jiraCloudProvider.searchIssues(http, { server: SITE }, ['VCS'], { words: 'keep' });
    expect(issues.map((issue) => [issue.key, issue.title, issue.statusCategory])).toEqual([
      ['VCS-12', 'Keep the selection when the layout changes', 'inProgress'],
      ['VCS-13', 'Won’t fix this', 'done'],
    ]);
    expect(tracker.requests[0]!.json).toEqual({ jql: 'project in ("VCS") AND summary ~ "keep*" ORDER BY updated DESC', fields: ['summary', 'status', 'issuetype', 'assignee'], maxResults: 20 });
  });

  it('finds nothing as an empty list, and a refused search as no access', async () => {
    const { http } = connected({ [`POST ${SITE}/rest/api/3/search/jql`]: [{ json: { issues: [] } }, { status: 403, json: { errorMessages: ['Forbidden'] } }] });
    expect(await jiraCloudProvider.searchIssues(http, { server: SITE }, ['VCS'], {})).toEqual([]);
    await expect(jiraCloudProvider.searchIssues(http, { server: SITE }, ['VCS'], {})).rejects.toMatchObject({ reason: 'noAccess' });
  });
});
