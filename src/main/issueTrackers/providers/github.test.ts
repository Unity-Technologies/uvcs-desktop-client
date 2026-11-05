import { describe, expect, it } from 'vitest';
import { fakeTrackerHttp, type TrackerAnswers } from '../testing/fakeTrackerHttp';
import { githubProvider } from './github';

const GITHUB = 'https://github.com';
const GRAPHQL = 'https://api.github.com/graphql';

/** `GET /user`, as GitHub answers it. */
const USER = { login: 'ana-diaz', id: 1234, name: 'Ana Díaz', type: 'User' };

function connected(answers: TrackerAnswers, server = GITHUB) {
  const tracker = fakeTrackerHttp(answers);
  return { tracker, http: tracker.http.bound(githubProvider.origins(server), githubProvider.authorization({ token: 'ghp_x' })) };
}

/** An issue and a pull request as the batch's fragments read them. */
const ISSUE = { __typename: 'Issue', number: 12, title: 'Crash on start', url: 'https://github.com/acme/game/issues/12', state: 'OPEN', stateReason: null, assignees: { nodes: [{ login: 'lena', name: 'Lena Marsh' }] } };
const PULL_REQUEST = { __typename: 'PullRequest', number: 13, title: 'Fix the crash', url: 'https://github.com/acme/game/pull/13', state: 'MERGED', isDraft: false, merged: true, assignees: { nodes: [] } };

describe('the GitHub provider', () => {
  it('signs in with a Bearer token', async () => {
    const { tracker, http } = connected({ 'GET https://api.github.com/user': { json: USER } });
    expect(await githubProvider.signIn(http, GITHUB)).toEqual({ account: { id: 'ana-diaz', name: 'Ana Díaz' } });
    expect(tracker.requests[0]!.headers.Authorization).toBe('Bearer ghp_x');
  });

  it('says a server whose /api/v3 answers no API isn’t GitHub Enterprise Server', async () => {
    const { http } = connected({ 'GET https://git.acme.com/api/v3/user': { status: 404, text: '<html>Not Found</html>' } }, 'https://git.acme.com');
    await expect(githubProvider.signIn(http, 'https://git.acme.com')).rejects.toThrow("https://git.acme.com doesn't answer as this tracker");
  });

  it('proves a repository in one GraphQL request: its open issues, without pull requests, and those assigned', async () => {
    const { tracker, http } = connected({ [`POST ${GRAPHQL}`]: { json: { data: { repository: { nameWithOwner: 'acme/game', issues: { totalCount: 42 } }, search: { issueCount: 3 } } } } });
    expect(await githubProvider.projectAccess(http, { server: GITHUB }, 'acme/game')).toEqual({ project: 'acme/game', name: 'acme/game', openIssues: 42, assignedToYou: 3 });
    expect(tracker.requests[0]!.json).toMatchObject({ variables: { owner: 'acme', name: 'game', assigned: 'repo:acme/game is:issue is:open assignee:@me' } });
  });

  it('fails a repository the token can’t see as no access', async () => {
    const { http } = connected({ [`POST ${GRAPHQL}`]: { json: { data: { repository: null, search: { issueCount: 0 } }, errors: [{ type: 'NOT_FOUND', path: ['repository'], message: "Could not resolve to a Repository with the name 'acme/game'." }] } } });
    await expect(githubProvider.projectAccess(http, { server: GITHUB }, 'acme/game')).rejects.toMatchObject({ reason: 'noAccess' });
  });

  it('reads issues and pull requests in one query, one alias each, the repositories as variables', async () => {
    const { tracker, http } = connected({
      [`POST ${GRAPHQL}`]: {
        json: {
          data: { r0: { i0: ISSUE, i1: PULL_REQUEST, i2: null }, r1: null },
          errors: [
            { type: 'NOT_FOUND', path: ['r0', 'i2'], message: 'Could not resolve to an issue or pull request with the number of 99.' },
            { type: 'NOT_FOUND', path: ['r1'], message: "Could not resolve to a Repository with the name 'secret/vault'." },
          ],
        },
      },
    });
    const reads = await githubProvider.readIssues(http, { server: GITHUB }, ['acme/game#12', 'acme/game#13', 'acme/game#99', 'secret/vault#1']);
    expect(reads).toEqual([
      { key: 'acme/game#12', kind: 'found', issue: { key: 'acme/game#12', title: 'Crash on start', status: 'Open', statusCategory: 'todo', type: 'Issue', assignee: { id: 'lena', name: 'Lena Marsh' }, url: ISSUE.url } },
      { key: 'acme/game#13', kind: 'found', issue: expect.objectContaining({ status: 'Merged', statusCategory: 'done', type: 'Pull request', assignee: null }) },
      { key: 'acme/game#99', kind: 'missing' },
      { key: 'secret/vault#1', kind: 'noAccess' },
    ]);
    expect(tracker.requests).toHaveLength(1);
    expect(tracker.requests[0]!.json).toMatchObject({ variables: { o0: 'acme', n0: 'game', o1: 'secret', n1: 'vault' } });
  });

  it('fails a batch GitHub rate limited with a 200, and rests its origin', async () => {
    const { tracker, http } = connected({ [`POST ${GRAPHQL}`]: { json: { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }, headers: { 'x-ratelimit-reset': '9999999999' } } });
    await expect(githubProvider.readIssues(http, { server: GITHUB }, ['acme/game#12'])).rejects.toMatchObject({ reason: 'rateLimited' });
    await expect(githubProvider.readIssues(http, { server: GITHUB }, ['acme/game#12'])).rejects.toMatchObject({ reason: 'rateLimited' });
    expect(tracker.requests).toHaveLength(1);
  });

  it('maps closed issues by why, and open and draft pull requests as in progress', async () => {
    const closed = (stateReason: string) => ({ ...ISSUE, state: 'CLOSED', stateReason });
    const { http } = connected({
      [`POST ${GRAPHQL}`]: {
        json: { data: { r0: { i0: closed('COMPLETED'), i1: closed('NOT_PLANNED'), i2: closed('DUPLICATE'), i3: { ...PULL_REQUEST, state: 'OPEN', merged: false, isDraft: true }, i4: { ...PULL_REQUEST, state: 'CLOSED', merged: false } } } },
      },
    });
    const reads = await githubProvider.readIssues(http, { server: GITHUB }, ['acme/game#1', 'acme/game#2', 'acme/game#3', 'acme/game#4', 'acme/game#5']);
    expect(reads.map((read) => (read.kind === 'found' ? [read.issue.status, read.issue.statusCategory] : read.kind))).toEqual([
      ['Closed', 'done'],
      ['Closed', 'canceled'],
      ['Closed', 'canceled'],
      ['Draft', 'inProgress'],
      ['Closed', 'canceled'],
    ]);
  });
});
