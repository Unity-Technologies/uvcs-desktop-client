// A fake Jira Cloud and GitHub, to see the issue trackers' flows in a development build with no account and no network
// (docs/features/issue-trackers.md, "Seams the tests replace"): `UVCS_FAKE_TRACKERS=<this file>` makes main's
// `TrackerHttp` ask this `fetch` instead of the network (`createIssueTrackers`; a packaged app ignores it). Its answers
// are shaped as each tracker's (the providers' tests hold recorded ones). Any token of a tracker's shape signs in, but
// one holding `bad`; GitHub's device flow approves at the fourth poll, about twelve seconds in. Unknown requests answer 404.
'use strict';

const JIRA = 'https://acme.atlassian.net';

const JIRA_ISSUES = {
  'VCS-12': { summary: 'Keep the selection when the layout changes', status: 'In Progress', category: 'indeterminate', type: 'Bug', assignee: 'Lena Marsh' },
  'VCS-13': { summary: 'Update fails on paths longer than 260 characters', status: 'To Do', category: 'new', type: 'Task', assignee: null },
  'VCS-14': { summary: 'Show the changes of xlinked repositories in Incoming', status: 'Done', category: 'done', type: 'Story', assignee: 'Ana Díaz' },
};

const GITHUB_ISSUES = {
  12: { __typename: 'Issue', title: 'Crash when opening a model', state: 'OPEN', stateReason: null, assignee: 'lena' },
  13: { __typename: 'PullRequest', title: 'Fix the crash on start', state: 'MERGED', merged: true, isDraft: false, assignee: null },
};

let devicePolls = 0;

function answer(status, json, headers = {}) {
  const text = json === undefined ? '' : JSON.stringify(json);
  const all = new Map(Object.entries({ 'content-type': 'application/json', ...headers }).map(([name, value]) => [name.toLowerCase(), value]));
  return { status, headers: { get: (name) => all.get(name.toLowerCase()) ?? null }, text: async () => text };
}

function tokenOf(headers) {
  const authorization = headers.Authorization ?? '';
  if (authorization.startsWith('Basic ')) return Buffer.from(authorization.slice(6), 'base64').toString().split(':').slice(1).join(':');
  return authorization.replace(/^Bearer /, '');
}

function jira(url, init) {
  if (url.pathname === '/_edge/tenant_info') return answer(200, { cloudId: 'fake-cloud' });
  if (tokenOf(init.headers).includes('bad')) return answer(401, { errorMessages: ['Client must be authenticated'] });
  const path = url.pathname.replace(/^\/ex\/jira\/fake-cloud/, '');
  if (path === '/rest/api/3/myself') return answer(200, { accountId: '5b10ac8d', displayName: 'Ana Díaz', emailAddress: 'ana@acme.com' });
  const project = /^\/rest\/api\/3\/project\/([A-Z0-9_]+)$/.exec(path);
  if (project) return project[1] === 'VCS' ? answer(200, { key: 'VCS', name: 'Version Control' }) : answer(404, { errorMessages: ['No project could be found'] });
  if (path === '/rest/api/3/search/approximate-count') return answer(200, { count: JSON.parse(init.body).jql.includes('currentUser') ? 6 : 214 });
  if (path === '/rest/api/3/issue/bulkfetch') {
    const keys = JSON.parse(init.body).issueIdsOrKeys;
    const issues = keys
      .filter((key) => JIRA_ISSUES[key])
      .map((key) => {
        const issue = JIRA_ISSUES[key];
        return {
          key,
          fields: {
            summary: issue.summary,
            status: { name: issue.status, statusCategory: { key: issue.category } },
            issuetype: { name: issue.type },
            assignee: issue.assignee && { accountId: issue.assignee, displayName: issue.assignee },
          },
        };
      });
    return answer(200, { issues, issueErrors: [] });
  }
  return answer(404, { errorMessages: ['Not found'] });
}

function github(url, init) {
  const path = url.pathname;
  if (url.host === 'github.com' && path === '/login/device/code') {
    devicePolls = 0;
    return answer(200, { device_code: 'fake-device', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 3 });
  }
  if (url.host === 'github.com' && path === '/login/oauth/access_token') {
    devicePolls++;
    return answer(200, devicePolls < 4 ? { error: 'authorization_pending' } : { access_token: `gho_${'f'.repeat(36)}`, token_type: 'bearer', scope: 'repo' });
  }
  if (tokenOf(init.headers).includes('bad')) return answer(401, { message: 'Bad credentials' });
  if (path === '/user') return answer(200, { login: 'ana-diaz', name: 'Ana Díaz' });
  if (path === '/graphql') {
    const { query, variables } = JSON.parse(init.body);
    if (query.startsWith('query Access')) return answer(200, { data: { repository: { nameWithOwner: `${variables.owner}/${variables.name}`, issues: { totalCount: 42 } }, search: { issueCount: 3 } } });
    // Each issue alias belongs to the repository alias before it, as the batch writes them.
    const data = {};
    let repository = null;
    for (const [, alias, issueAlias, number] of query.matchAll(/(r\d+): repository|(i\d+): issueOrPullRequest\(number: (\d+)\)/g)) {
      if (alias) {
        repository = data[alias] = {};
        continue;
      }
      const issue = GITHUB_ISSUES[number];
      repository[issueAlias] = issue
        ? { ...issue, number: Number(number), url: `https://github.com/acme/game/issues/${number}`, assignees: { nodes: issue.assignee ? [{ login: issue.assignee, name: 'Lena Marsh' }] : [] } }
        : null;
    }
    return answer(200, { data });
  }
  return answer(404, { message: 'Not Found' });
}

exports.fetch = async (address, init) => {
  const url = new URL(address);
  if (url.origin === JIRA || url.host === 'api.atlassian.com') return jira(url, init);
  if (url.host === 'github.com' || url.host === 'api.github.com') return github(url, init);
  return answer(404, undefined);
};
