import { describe, expect, it } from 'vitest';
import { signInFailureOf } from '../signIn/signInFailures';
import { fakeTrackerHttp, type TrackerAnswers } from '../testing/fakeTrackerHttp';
import { jiraDataCenterProvider, MAX_SEARCH_URL_LENGTH, searchUrls } from './jiraDataCenter';

const SERVER = 'https://jira.acme.com';
const TOKEN = 'fake-data-center-token-for-tests-0123456789';

/** `GET /rest/api/2/myself`, as Jira Data Center answers it. */
const MYSELF = { self: `${SERVER}/rest/api/2/user?username=ana.diaz`, key: 'JIRAUSER10100', name: 'ana.diaz', emailAddress: 'ana@acme.com', displayName: 'Ana Díaz', active: true };

/** `GET /rest/api/2/search` for issues, as Jira Data Center answers it. */
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

/**
 * What Jira Data Center answers a search whose body it can't take: `validateQuery` is a boolean there (`warn` is Cloud's
 * word), so a Cloud-shaped search is a 400. A read-only token (resolution's API Token Authentication) refuses any POST.
 */
const BAD_SEARCH = { status: 400, json: { errorMessages: ['Can not deserialize value of type boolean from String "warn"'], errors: {} } };
const READ_ONLY_POST = { status: 403, json: { errorMessages: ['This token allows read access only'], errors: {} } };

/** A search's address, its query as `URLSearchParams` writes it. */
function searchUrl(params: Record<string, string>, server = SERVER): string {
  return `${server}/rest/api/2/search?${new URLSearchParams(params).toString()}`;
}

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

  it('proves a project with its name and its counts, each count a GET', async () => {
    const open = 'project = "VCS" AND statusCategory != Done';
    const mine = `${open} AND assignee = currentUser()`;
    const { tracker, http } = connected({
      [`GET ${SERVER}/rest/api/2/project/VCS`]: { json: { key: 'VCS', name: 'Version Control' } },
      [`GET ${searchUrl({ jql: open, maxResults: '0' })}`]: { json: { startAt: 0, maxResults: 0, total: 214, issues: [] } },
      [`GET ${searchUrl({ jql: mine, maxResults: '0' })}`]: { json: { startAt: 0, maxResults: 0, total: 6, issues: [] } },
      [`POST ${SERVER}/rest/api/2/search`]: READ_ONLY_POST,
    });
    expect(await jiraDataCenterProvider.projectAccess(http, { server: SERVER }, 'VCS')).toEqual({ project: 'VCS', name: 'Version Control', openIssues: 214, assignedToYou: 6 });
    expect(tracker.requests.map((request) => request.method)).toEqual(['GET', 'GET', 'GET']);
  });

  it('reads every key in one search, a missing one as missing, its status by category', async () => {
    // `validateQuery=false`: with Data Center's default (true), one key that doesn't exist fails the whole search.
    const asked = searchUrl({ jql: 'key in ("VCS-12", "VCS-13", "VCS-99")', fields: 'summary,status,issuetype,assignee', maxResults: '3', validateQuery: 'false' });
    const { tracker, http } = connected({ [`GET ${asked}`]: { json: SEARCH }, [`POST ${SERVER}/rest/api/2/search`]: BAD_SEARCH });
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
    expect(tracker.lines()).toEqual([`GET ${asked}`]);
  });

  it('reads with GET only, so a read-only token reads', async () => {
    const asked = searchUrl({ jql: 'key in ("VCS-12")', fields: 'summary,status,issuetype,assignee', maxResults: '1', validateQuery: 'false' });
    const { http } = connected({ [`GET ${asked}`]: { json: { ...SEARCH, issues: SEARCH.issues.slice(0, 1) } }, [`POST ${SERVER}/rest/api/2/search`]: READ_ONLY_POST });
    expect((await jiraDataCenterProvider.readIssues(http, { server: SERVER }, ['VCS-12']))[0]).toMatchObject({ key: 'VCS-12', kind: 'found' });
  });

  it('reads 100 keys in one request whose address stays well under 8 KB', async () => {
    const keys = Array.from({ length: 100 }, (_, index) => `VCS-${1009000 + index}`);
    const asked = searchUrl({ jql: `key in (${keys.map((key) => `"${key}"`).join(', ')})`, fields: 'summary,status,issuetype,assignee', maxResults: '100', validateQuery: 'false' });
    const { tracker, http } = connected({ [`GET ${asked}`]: { json: { issues: [] } } });
    await jiraDataCenterProvider.readIssues(http, { server: SERVER }, keys);
    expect(tracker.requests).toHaveLength(1);
    expect(tracker.requests[0]!.url.length).toBeLessThanOrEqual(MAX_SEARCH_URL_LENGTH);
  });

  it('splits keys too long for one address into several searches, each under the limit, every key read', async () => {
    const keys = Array.from({ length: 100 }, (_, index) => `LONGPROJECTKEY_${'X'.repeat(50)}-${index + 1}`);
    const answering = (request: { url: string }) => {
      const jql = new URL(request.url).searchParams.get('jql') ?? '';
      const asked = [...jql.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
      return { json: { issues: asked.map((key) => ({ key, fields: { summary: key, status: { name: 'Open', statusCategory: { key: 'new' } }, issuetype: { name: 'Task' }, assignee: null } })) } };
    };
    const tracker = fakeTrackerHttp();
    const http = tracker.http.bound(jiraDataCenterProvider.origins(SERVER), jiraDataCenterProvider.authorization({ token: TOKEN }));
    const urls = searchUrls(SERVER, keys);
    for (const url of urls) tracker.answer({ [`GET ${url}`]: answering });
    const reads = await jiraDataCenterProvider.readIssues(http, { server: SERVER }, keys);
    expect(urls.length).toBeGreaterThan(1);
    expect(tracker.requests.map((request) => request.url)).toEqual(urls);
    expect(urls.every((url) => url.length <= MAX_SEARCH_URL_LENGTH)).toBe(true);
    expect(reads.map((read) => `${read.key} ${read.kind}`)).toEqual(keys.map((key) => `${key} found`));
  });

  it('fails a read the token may not make as no access', async () => {
    const asked = searchUrl({ jql: 'key in ("VCS-12")', fields: 'summary,status,issuetype,assignee', maxResults: '1', validateQuery: 'false' });
    const { http } = connected({ [`GET ${asked}`]: { status: 403, json: { errorMessages: ['Forbidden'], errors: {} } } });
    await expect(jiraDataCenterProvider.readIssues(http, { server: SERVER }, ['VCS-12'])).rejects.toMatchObject({ reason: 'noAccess' });
  });

  it('fails a refused token as refused', async () => {
    const { http } = connected({ [`GET ${SERVER}/rest/api/2/myself`]: { status: 401 } });
    await expect(jiraDataCenterProvider.signIn(http, SERVER)).rejects.toMatchObject({ reason: 'signInRefused' });
  });
});
