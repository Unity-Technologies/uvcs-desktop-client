// A fake Jira Cloud and GitHub, to see the issue trackers' flows in a development build with no account and no network
// (docs/features/issue-trackers.md, "Seams the tests replace"): `UVCS_FAKE_TRACKERS=<this file>` makes main's
// `TrackerHttp` ask this `fetch` instead of the network (`createIssueTrackers`; a packaged app ignores it). Its answers
// are shaped as each tracker's (the providers' tests hold recorded ones). Any token of a tracker's shape signs in, but
// one holding `bad`; GitHub's device flow approves at the fourth poll, about twelve seconds in. Unknown requests answer 404.
// A Jira token holding `expiring` shows signing in again: it signs in and proves its project, then its issues answer
// 401; trying it again finds Jira out of reach once, then refuses it, so a new token is asked for.
// A Jira Data Center is at https://jira.acme-corp.com (REST API v2, a personal access token as Bearer): any token
// signs in but one holding `login`, which it sends to its single sign-on page (a 302), as an SSO server does. Its tokens
// are read-only, as resolution's API Token Authentication makes them: any POST is a 403. A search takes a boolean
// `validateQuery`, and anything else is a 400, as Data Center answers it.
// Searches (`#` in a comment): the account's open issues are those not done; words find the titles holding them all.
'use strict';

const JIRA = 'https://acme.atlassian.net';

const JIRA_ISSUES = {
  'VCS-12': { summary: 'Keep the selection when the layout changes', status: 'In Progress', category: 'indeterminate', type: 'Bug', assignee: 'Lena Marsh' },
  'VCS-13': { summary: 'Update fails on paths longer than 260 characters', status: 'To Do', category: 'new', type: 'Task', assignee: null },
  'VCS-14': { summary: 'Show the changes of xlinked repositories in Incoming', status: 'Done', category: 'done', type: 'Story', assignee: 'Ana Díaz' },
  'VCS-15': { summary: 'Crash when a branch name holds an emoji', status: 'In Review', category: 'indeterminate', type: 'Bug', assignee: 'Ana Díaz' },
  'VCS-16': { summary: 'Faster Branch Explorer on large repositories', status: 'To Do', category: 'new', type: 'Story', assignee: 'Ana Díaz' },
};

/** A Jira issue as a search or `bulkfetch` answers it. */
function jiraIssue(key) {
  const issue = JIRA_ISSUES[key];
  return {
    key,
    fields: {
      summary: issue.summary,
      status: { name: issue.status, statusCategory: { key: issue.category } },
      issuetype: { name: issue.type },
      assignee: issue.assignee && { accountId: issue.assignee, key: issue.assignee, displayName: issue.assignee },
    },
  };
}

/** The issues a `#` search's JQL finds: the account's not done, or the titles holding every word (the last a prefix). */
function jiraSearched(jql) {
  const words = /summary ~ "([^"]*)"/.exec(jql);
  const keys = Object.keys(JIRA_ISSUES).filter((key) => {
    const issue = JIRA_ISSUES[key];
    if (!words) return issue.assignee === 'Ana Díaz' && issue.category !== 'done';
    const title = issue.summary.toLowerCase();
    return words[1].replace(/\*$/, '').split(' ').every((word) => title.split(/\W+/).some((titleWord) => titleWord.startsWith(word)));
  });
  return keys.reverse().map(jiraIssue);
}

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

const myselfAsked = new Map();

function expiring(token, path) {
  if (path === '/rest/api/3/issue/bulkfetch') return answer(401, { errorMessages: ['Client must be authenticated'] });
  if (path !== '/rest/api/3/myself') return null;
  const asked = (myselfAsked.get(token) ?? 0) + 1;
  myselfAsked.set(token, asked);
  if (asked === 2) throw new Error('Jira is out of reach');
  return asked > 2 ? answer(401, { errorMessages: ['Client must be authenticated'] }) : null;
}

function jira(url, init) {
  if (url.pathname === '/_edge/tenant_info') return answer(200, { cloudId: 'fake-cloud' });
  const token = tokenOf(init.headers);
  if (token.includes('bad')) return answer(401, { errorMessages: ['Client must be authenticated'] });
  const path = url.pathname.replace(/^\/ex\/jira\/fake-cloud/, '');
  const expired = token.includes('expiring') ? expiring(token, path) : null;
  if (expired) return expired;
  if (path === '/rest/api/3/myself') return answer(200, { accountId: '5b10ac8d', displayName: 'Ana Díaz', emailAddress: 'ana@acme.com' });
  const project = /^\/rest\/api\/3\/project\/([A-Z0-9_]+)$/.exec(path);
  if (project) return project[1] === 'VCS' ? answer(200, { key: 'VCS', name: 'Version Control' }) : answer(404, { errorMessages: ['No project could be found'] });
  if (path === '/rest/api/3/search/jql') return answer(200, { issues: jiraSearched(JSON.parse(init.body).jql) });
  if (path === '/rest/api/3/search/approximate-count') return answer(200, { count: JSON.parse(init.body).jql.includes('currentUser') ? 6 : 214 });
  if (path === '/rest/api/3/issue/bulkfetch') {
    const keys = JSON.parse(init.body).issueIdsOrKeys;
    const issues = keys.filter((key) => JIRA_ISSUES[key]).map(jiraIssue);
    return answer(200, { issues, issueErrors: [] });
  }
  return answer(404, { errorMessages: ['Not found'] });
}

/** The issues a `#` search's query finds: the open ones, or the titles holding every quoted word. */
function githubSearched(q) {
  const words = [...q.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
  return Object.entries(GITHUB_ISSUES)
    .filter(([, issue]) => issue.__typename === 'Issue' && (words.length === 0 ? issue.state === 'OPEN' : words.every((word) => issue.title.toLowerCase().includes(word))))
    .map(([number, issue]) => ({ ...issue, number: Number(number), url: `https://github.com/acme/game/issues/${number}`, repository: { nameWithOwner: 'acme/game' }, assignees: { nodes: [] } }));
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
    if (query.startsWith('query Search')) return answer(200, { data: { search: { nodes: githubSearched(variables.q) } } });
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

const DATA_CENTER = 'https://jira.acme-corp.com';

function jiraDataCenter(url, init) {
  const token = tokenOf(init.headers);
  if (token.includes('login')) return answer(302, undefined, { location: `${DATA_CENTER}/plugins/servlet/samlsso?redirectTo=${encodeURIComponent(url.pathname)}` });
  if (init.method !== 'GET') return answer(403, { errorMessages: ['This token allows read access only'], errors: {} });
  const path = url.pathname;
  // The API Token Authentication app's page asks for a sign-in, as on a server that has it: "Create a token" opens it.
  if (path === '/plugins/servlet/de.resolution.apitokenauth/admin') return answer(401, undefined);
  if (path === '/rest/api/2/myself') return answer(200, { key: 'JIRAUSER10100', name: 'ana.diaz', displayName: 'Ana Díaz', emailAddress: 'ana@acme-corp.com' });
  const project = /^\/rest\/api\/2\/project\/([A-Z0-9_]+)$/.exec(path);
  if (project) return project[1] === 'VCS' ? answer(200, { key: 'VCS', name: 'Version Control' }) : answer(404, { errorMessages: ['No project could be found'] });
  if (path === '/rest/api/2/search') {
    const jql = url.searchParams.get('jql') ?? '';
    const validateQuery = url.searchParams.get('validateQuery');
    if (validateQuery !== null && validateQuery !== 'true' && validateQuery !== 'false') {
      return answer(400, { errorMessages: [`Can not deserialize value of type boolean from String "${validateQuery}"`], errors: {} });
    }
    const keys = /key in \((.*)\)/.exec(jql);
    if (jql.includes('ORDER BY')) return answer(200, { startAt: 0, maxResults: 20, total: 0, issues: jiraSearched(jql) });
    if (!keys) return answer(200, { startAt: 0, maxResults: 0, total: jql.includes('currentUser') ? 4 : 128, issues: [] });
    const asked = [...keys[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    const issues = asked.filter((key) => JIRA_ISSUES[key]).map(jiraIssue);
    return answer(200, { startAt: 0, maxResults: asked.length, total: issues.length, issues });
  }
  return answer(404, { errorMessages: ['Not found'] });
}

exports.fetch = async (address, init) => {
  const url = new URL(address);
  if (url.origin === DATA_CENTER) return jiraDataCenter(url, init);
  if (url.origin === JIRA || url.host === 'api.atlassian.com') return jira(url, init);
  if (url.host === 'github.com' || url.host === 'api.github.com') return github(url, init);
  return answer(404, undefined);
};
