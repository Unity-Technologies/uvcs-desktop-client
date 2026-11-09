import { isPlausibleToken, type TrackerGrammar } from '../trackerGrammar';
import { browsedIssue, JIRA_KEY, jiraIssueUrl, jiraReferencesReader } from './jiraKeys';

/** Atlassian's API tokens since 2023 start so; an older one is 24 letters and digits. */
const ATLASSIAN_TOKEN = /^ATATT[A-Za-z0-9_\-=]{20,}$/;
const CLASSIC_ATLASSIAN_TOKEN = /^[A-Za-z0-9]{24}$/;

/** Jira Cloud's sites: `<site>.atlassian.net`, and older `<site>.jira.com`. */
export function isJiraCloudHost(host: string): boolean {
  return /^[a-z0-9-]+\.(atlassian\.net|jira\.com)$/i.test(host);
}

export const jiraCloudGrammar: TrackerGrammar = {
  kind: 'jiraCloud',
  name: 'Jira',

  recognize(url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!isJiraCloudHost(url.hostname)) return null;
    const server = `https://${url.hostname.toLowerCase()}`;
    const browsed = browsedIssue(url.pathname);
    if (browsed && !browsed.contextPath) return { kind: 'jiraCloud', server, project: browsed.key[1]!, key: browsed.key[0], shows: 'issuePage' };
    const selected = JIRA_KEY.exec(url.searchParams.get('selectedIssue') ?? '');
    if (selected) return { kind: 'jiraCloud', server, project: selected[1]!, key: selected[0], shows: 'issueInView' };
    return { kind: 'jiraCloud', notAnIssue: jiraPageName(url.pathname) };
  },

  referencesReader: jiraReferencesReader,

  issueUrl: jiraIssueUrl,

  tokenPageUrl: () => 'https://id.atlassian.com/manage-profile/security/api-tokens',

  tokenShape(token) {
    if (ATLASSIAN_TOKEN.test(token)) return 'known';
    return CLASSIC_ATLASSIAN_TOKEN.test(token) || isPlausibleToken(token) ? 'plausible' : 'none';
  },
};

/** What a Jira page that isn't an issue is, in words, for "That's a link to a Jira board, not an issue". */
function jiraPageName(path: string): string {
  if (/\/boards\//.test(path)) return 'a Jira board';
  if (/\/projects\//.test(path)) return 'a Jira project';
  if (/\/filters?\b|\/issues\/?$/.test(path)) return 'a Jira search';
  return 'a Jira page';
}
