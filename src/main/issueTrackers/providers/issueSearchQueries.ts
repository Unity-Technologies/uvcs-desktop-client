import type { IssueSearch } from '@shared/domain/issueTrackers';
import { jqlString } from './jiraIssues';

/**
 * Lucene's reserved characters, which Jira's text search (`~`) reads as syntax, and the quote and backslash a JQL
 * string escapes: dropped from the words, as no title is found by them.
 */
const JIRA_TEXT_SYNTAX = /[+\-&|!(){}[\]^~*?:\\/"]/g;

/**
 * The words of a title search, as Jira's text search takes them: its syntax dropped, lower case (so `AND`, `OR` and
 * `NOT` are words, not Lucene's operators), the last word a prefix (`selec*`), as it's still being typed. Null when
 * no word is left.
 */
export function jiraTitleWords(words: string): string | null {
  const plain = words.replace(JIRA_TEXT_SYNTAX, ' ').toLowerCase().split(/\s+/).filter(Boolean);
  return plain.length > 0 ? `${plain.join(' ')}*` : null;
}

/**
 * A `#` search as JQL (docs/features/issue-trackers.md, "Suggesting issues"): the bound projects; with words, the
 * issues whose title holds them; without, the account's issues not done. The user's words only ever go inside one
 * quoted string (`jqlString`), so nothing typed widens the search. Most recently updated first.
 */
export function jiraSearchJql(projects: readonly string[], search: IssueSearch): string {
  const scope = `project in (${projects.map(jqlString).join(', ')})`;
  const words = search.words === undefined ? null : jiraTitleWords(search.words);
  const filter = words === null ? 'assignee = currentUser() AND statusCategory != Done' : `summary ~ ${jqlString(words)}`;
  return `${scope} AND ${filter} ORDER BY updated DESC`;
}

/**
 * A `#` search as GitHub's search query: the bound repositories, issues only, most recently updated first; with words,
 * each one quoted in the title (its quotes dropped, so `repo:other` typed is a word, never a qualifier); without, the
 * account's open issues. GitHub's search has no prefix match: a word typed half finds what holds it whole.
 */
export function githubSearchQuery(repositories: readonly string[], search: IssueSearch): string {
  const scope = [...repositories.map((repository) => `repo:${repository}`), 'is:issue', 'sort:updated-desc'];
  const words = (search.words ?? '').replace(/"/g, ' ').split(/\s+/).filter(Boolean);
  const filter = words.length > 0 ? ['in:title', ...words.map((word) => `"${word}"`)] : ['is:open', 'assignee:@me'];
  return [...scope, ...filter].join(' ');
}
