import { escapeRegExp } from '../../escapeRegExp';
import { REFERENCE_END, REFERENCE_START, type FoundIssueReference } from '../trackerGrammar';

/**
 * A Jira key, the same on Jira Cloud and Data Center: the project's key (a letter, then upper-case letters, digits or
 * `_`), a dash, the issue's number.
 */
export const JIRA_KEY = /^([A-Z][A-Z0-9_]+)-([1-9]\d*)$/;

/** `<base>/browse/KEY-1`: an issue's own page, the base being the server with its context path, if any. */
const BROWSE = /^(.*)\/browse\/([^/]+)\/?$/;

/**
 * An issue page's path read: its server's context path (`/jira`, or none) and key. A key is plain ASCII, never
 * percent-encoded: the path is read as it is, so a malformed one (`%E0`) is no key.
 */
export function browsedIssue(path: string): { contextPath: string; key: RegExpExecArray } | null {
  const browse = BROWSE.exec(path);
  const key = browse && JIRA_KEY.exec(browse[2]!);
  return browse && key ? { contextPath: browse[1]!, key } : null;
}

/**
 * What reads the bound projects' keys in a text, its pattern built once (`TrackerGrammar.referencesReader`). A `#`
 * right before a key is part of it (`#VCS-12`, as a picked issue writes it: its trigger kept, as `@` and `cs:` are),
 * so its chip covers it; the key is read without it.
 */
export function jiraReferencesReader(projects: readonly string[]): (text: string) => FoundIssueReference[] {
  if (projects.length === 0) return () => [];
  const keys = new RegExp(`${REFERENCE_START}#?((?:${projects.map(escapeRegExp).join('|')})-[1-9]\\d*)${REFERENCE_END}`, 'gu');
  return (text) => {
    const found: FoundIssueReference[] = [];
    for (const match of text.matchAll(keys)) found.push({ key: match[1]!, bare: false, source: match[0], from: match.index, to: match.index + match[0].length });
    return found;
  };
}

export function jiraIssueUrl(server: string, key: string): string {
  return `${server}/browse/${encodeURIComponent(key)}`;
}
