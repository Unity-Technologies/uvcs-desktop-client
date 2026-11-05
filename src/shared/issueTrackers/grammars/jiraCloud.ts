import { escapeRegExp } from '../../escapeRegExp';
import { isPlausibleToken, REFERENCE_END, REFERENCE_START, type FoundIssueReference, type TrackerGrammar } from '../trackerGrammar';

/** A Jira key: the project's key (a letter, then upper-case letters, digits or `_`), a dash, the issue's number. */
const KEY = /^([A-Z][A-Z0-9_]+)-([1-9]\d*)$/;

/** Atlassian's API tokens since 2023 start so; an older one is 24 letters and digits. */
const ATLASSIAN_TOKEN = /^ATATT[A-Za-z0-9_\-=]{20,}$/;
const CLASSIC_ATLASSIAN_TOKEN = /^[A-Za-z0-9]{24}$/;

/** Jira Cloud's sites: `<site>.atlassian.net`, and older `<site>.jira.com`. */
function isJiraCloudHost(host: string): boolean {
  return /^[a-z0-9-]+\.(atlassian\.net|jira\.com)$/i.test(host);
}

export const jiraCloudGrammar: TrackerGrammar = {
  kind: 'jiraCloud',
  name: 'Jira',

  recognize(url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!isJiraCloudHost(url.hostname)) return null;
    const server = `https://${url.hostname.toLowerCase()}`;
    const browsed = /^\/browse\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    const browsedKey = browsed && KEY.exec(decodeURIComponent(browsed));
    if (browsedKey) return { kind: 'jiraCloud', server, project: browsedKey[1]!, key: browsedKey[0], shows: 'issuePage' };
    const selected = KEY.exec(url.searchParams.get('selectedIssue') ?? '');
    if (selected) return { kind: 'jiraCloud', server, project: selected[1]!, key: selected[0], shows: 'issueInView' };
    return { kind: 'jiraCloud', notAnIssue: jiraPageName(url.pathname) };
  },

  referencesIn(text, projects) {
    if (projects.length === 0) return [];
    const keys = new RegExp(`${REFERENCE_START}(?:${projects.map(escapeRegExp).join('|')})-[1-9]\\d*${REFERENCE_END}`, 'gu');
    const found: FoundIssueReference[] = [];
    for (const match of text.matchAll(keys)) found.push({ key: match[0], bare: false, source: match[0], from: match.index, to: match.index + match[0].length });
    return found;
  },

  issueUrl: (server, key) => `${server}/browse/${encodeURIComponent(key)}`,

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
