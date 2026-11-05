import { describe, expect, it } from 'vitest';
import { signInFailureOf } from '../signIn/signInFailures';
import { fakeTrackerHttp, type TrackerAnswers } from '../testing/fakeTrackerHttp';
import { jiraDataCenterProvider } from './jiraDataCenter';

const SERVER = 'https://jira.acme.com';
const TOKEN = 'fake-data-center-token-for-tests-0123456789';

/** `GET /rest/api/2/myself`, as Jira Data Center answers it. */
const MYSELF = { self: `${SERVER}/rest/api/2/user?username=ana.diaz`, key: 'JIRAUSER10100', name: 'ana.diaz', emailAddress: 'ana@acme.com', displayName: 'Ana Díaz', active: true };

/** `POST /rest/api/2/search` for issues, as Jira Data Center answers it. */
const SEARCH = {
  expand: 'schema,names',
  startAt: 0,
  maxResults: 3,
  total: 2,
  issues: [
    {
      id: '10002',
      key: 'VCS-12',
      fields: {
        summary: 'Keep the selection when the layout changes',
        status: { name: 'In Progress', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
        issuetype: { name: 'Bug' },
        assignee: { key: 'JIRAUSER10200', name: 'lena.marsh', displayName: 'Lena Marsh', emailAddress: 'lena@acme.com' },
      },
    },
    { id: '10003', key: 'VCS-13', fields: { summary: 'Done long ago', status: { name: 'Closed', statusCategory: { key: 'done' } }, issuetype: { name: 'Task' }, assignee: null } },
  ],
  warningMessages: ["An issue with key 'VCS-99' does not exist for field 'key'."],
};

function connected(answers: TrackerAnswers, server = SERVER) {
  const tracker = fakeTrackerHttp(answers);
  return { tracker, http: tracker.http.bound(jiraDataCenterProvider.origins(server), jiraDataCenterProvider.authorization({ token: TOKEN })) };
}

describe('the Jira Data Center provider', () => {
  it('signs in with a personal access token as Bearer', async () => {
    const { tracker, http } = connected({ [`GET ${SERVER}/rest/api/2/myself`]: { json: MYSELF } });
    expect(await jiraDataCenterProvider.signIn(http, SERVER)).toEqual({ account: { id: 'JIRAUSER10100', name: 'Ana Díaz', email: 'ana@acme.com' } });
    expect(tracker.requests[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('reaches a server under a context path', async () => {
    const server = 'https://tools.acme.com/jira';
    const { http } = connected({ [`GET ${server}/rest/api/2/myself`]: { json: MYSELF } }, server);
    expect((await jiraDataCenterProvider.signIn(http, server)).account.name).toBe('Ana Díaz');
  });

  it('says the server sent the sign-in to its login page when SSO redirects it', async () => {
    const { http } = connected({ [`GET ${SERVER}/rest/api/2/myself`]: { status: 302, headers: { Location: `${SERVER}/plugins/servlet/samlsso?redirectTo=%2Frest%2Fapi%2F2%2Fmyself` } } });
    const error = await jiraDataCenterProvider.signIn(http, SERVER).catch((caught: unknown) => caught);
    expect(signInFailureOf(error, SERVER)).toEqual({ reason: 'sentToLogin', server: SERVER });
  });

  it('proves a project with its name and its counts', async () => {
    const counts = (request: { json?: unknown }) => ({ json: { startAt: 0, maxResults: 0, total: String((request.json as { jql: string }).jql).includes('currentUser') ? 6 : 214, issues: [] } });
    const { tracker, http } = connected({ [`GET ${SERVER}/rest/api/2/project/VCS`]: { json: { key: 'VCS', name: 'Version Control' } }, [`POST ${SERVER}/rest/api/2/search`]: counts });
    expect(await jiraDataCenterProvider.projectAccess(http, { server: SERVER }, 'VCS')).toEqual({ project: 'VCS', name: 'Version Control', openIssues: 214, assignedToYou: 6 });
    expect(tracker.requests.slice(1).map((request) => request.json)).toEqual([
      { jql: 'project = "VCS" AND statusCategory != Done', maxResults: 0 },
      { jql: 'project = "VCS" AND statusCategory != Done AND assignee = currentUser()', maxResults: 0 },
    ]);
  });

  it('reads every key in one search, a missing one as missing, its status by category', async () => {
    const { tracker, http } = connected({ [`POST ${SERVER}/rest/api/2/search`]: { json: SEARCH } });
    const reads = await jiraDataCenterProvider.readIssues(http, { server: SERVER }, ['VCS-12', 'VCS-13', 'VCS-99']);
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
          assignee: { id: 'JIRAUSER10200', name: 'Lena Marsh', email: 'lena@acme.com' },
          url: `${SERVER}/browse/VCS-12`,
        },
      },
      { key: 'VCS-13', kind: 'found', issue: expect.objectContaining({ statusCategory: 'done', assignee: null }) },
      { key: 'VCS-99', kind: 'missing' },
    ]);
    expect(tracker.requests).toHaveLength(1);
    expect(tracker.requests[0]!.json).toEqual({
      jql: 'key in ("VCS-12", "VCS-13", "VCS-99")',
      fields: ['summary', 'status', 'issuetype', 'assignee'],
      maxResults: 3,
      validateQuery: 'warn',
    });
  });

  it('fails a refused token as refused', async () => {
    const { http } = connected({ [`GET ${SERVER}/rest/api/2/myself`]: { status: 401 } });
    await expect(jiraDataCenterProvider.signIn(http, SERVER)).rejects.toMatchObject({ reason: 'signInRefused' });
  });
});
