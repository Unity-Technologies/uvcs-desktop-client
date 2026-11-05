import { describe, expect, it } from 'vitest';
import { fakeTrackerHttp } from './testing/fakeTrackerHttp';
import { dataCenterTokenPage, TokenPages } from './tokenPages';

const SERVER = 'https://jira.acme.com';
const APP_PAGE = `${SERVER}/plugins/servlet/de.resolution.apitokenauth/admin`;
const JIRA_PAGE = `${SERVER}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;

describe('dataCenterTokenPage', () => {
  it('takes the API Token Authentication app’s page when its servlet answers, or asks for a sign-in', () => {
    expect(dataCenterTokenPage(401)).toBe('apiTokenApp');
    expect(dataCenterTokenPage(200)).toBe('apiTokenApp');
  });

  it('falls back to Jira’s own page for anything else: a login redirect, no such servlet, no answer', () => {
    expect(dataCenterTokenPage('login')).toBe('jira');
    expect(dataCenterTokenPage(404)).toBe('jira');
    expect(dataCenterTokenPage(302)).toBe('jira');
    expect(dataCenterTokenPage(null)).toBe('jira');
  });
});

describe('TokenPages', () => {
  it('asks a Data Center once, with no credential, whether the app’s page is there, and opens it', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${APP_PAGE}`]: { status: 401 } });
    const pages = new TokenPages(tracker.http);
    expect(await pages.urlOf({ kind: 'jiraDataCenter', server: SERVER }, 'usual')).toBe(APP_PAGE);
    expect(await pages.urlOf({ kind: 'jiraDataCenter', server: SERVER }, 'other')).toBe(JIRA_PAGE);
    expect(tracker.lines()).toEqual([`GET ${APP_PAGE}`]);
    expect(tracker.requests[0]).toMatchObject({ credentials: 'omit', redirect: 'manual' });
    expect(tracker.requests[0]!.headers.Authorization).toBeUndefined();
    expect(tracker.logged).toHaveLength(1);
  });

  it('opens Jira’s own page when the server sends the question to its login page, the app’s as the other', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${APP_PAGE}`]: { status: 302, headers: { Location: `${SERVER}/login.jsp?os_destination=%2Fplugins` } } });
    const pages = new TokenPages(tracker.http);
    expect(await pages.urlOf({ kind: 'jiraDataCenter', server: SERVER }, 'usual')).toBe(JIRA_PAGE);
    expect(await pages.urlOf({ kind: 'jiraDataCenter', server: SERVER }, 'other')).toBe(APP_PAGE);
  });

  it('opens Jira’s own page when the server can’t be reached', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${APP_PAGE}`]: { unreachable: true } });
    expect(await new TokenPages(tracker.http).urlOf({ kind: 'jiraDataCenter', server: SERVER }, 'usual')).toBe(JIRA_PAGE);
  });

  it('keeps a context path', async () => {
    const server = 'https://tools.acme.com/jira';
    const tracker = fakeTrackerHttp({ [`GET ${server}/plugins/servlet/de.resolution.apitokenauth/admin`]: { status: 200, text: '<html></html>' } });
    expect(await new TokenPages(tracker.http).urlOf({ kind: 'jiraDataCenter', server }, 'usual')).toBe(`${server}/plugins/servlet/de.resolution.apitokenauth/admin`);
  });

  it('asks nothing for the trackers with one token page', async () => {
    const tracker = fakeTrackerHttp();
    const pages = new TokenPages(tracker.http);
    expect(await pages.urlOf({ kind: 'github', server: 'https://github.com' }, 'other')).toBe('https://github.com/settings/tokens/new?scopes=repo&description=UVCS%20Desktop');
    expect(await pages.urlOf({ kind: 'jiraCloud', server: 'https://acme.atlassian.net' }, 'usual')).toBe('https://id.atlassian.com/manage-profile/security/api-tokens');
    expect(tracker.requests).toEqual([]);
  });
});
