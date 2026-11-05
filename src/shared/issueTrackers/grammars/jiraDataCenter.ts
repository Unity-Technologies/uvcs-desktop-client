import type { TrackerGrammar } from '../trackerGrammar';
import { isJiraCloudHost } from './jiraCloud';
import { browsedIssue, jiraIssueUrl, jiraReferencesReader } from './jiraKeys';

/**
 * A Data Center personal access token: no fixed prefix, a base64 text of about 44 characters. Only plausible, so a
 * paste never signs in by itself: "Sign in" does.
 */
const PERSONAL_ACCESS_TOKEN = /^[A-Za-z0-9+/=_-]{32,64}$/;

/**
 * Jira Data Center, self-hosted: an issue's page is `<server>/browse/KEY-1` on any host that isn't Jira Cloud's, the
 * server keeping its context path (`https://tools.acme.com/jira`). Its other pages look like any web page, so only an
 * issue's is read as this tracker's. Its keys and references are Jira's (`jiraKeys`).
 */
export const jiraDataCenterGrammar: TrackerGrammar = {
  kind: 'jiraDataCenter',
  name: 'Jira',

  recognize(url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (isJiraCloudHost(url.hostname)) return null;
    const browsed = browsedIssue(url.pathname);
    if (!browsed) return null;
    const server = `${url.protocol}//${url.host.toLowerCase()}${browsed.contextPath}`;
    return { kind: 'jiraDataCenter', server, project: browsed.key[1]!, key: browsed.key[0], shows: 'issuePage' };
  },

  referencesReader: jiraReferencesReader,

  issueUrl: jiraIssueUrl,

  tokenPageUrl: (server) => `${server}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`,

  tokenShape: (token) => (PERSONAL_ACCESS_TOKEN.test(token) ? 'plausible' : 'none'),
};
