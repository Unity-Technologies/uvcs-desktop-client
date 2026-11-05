import { describe, expect, it } from 'vitest';
import { githubSearchQuery, jiraSearchJql, jiraTitleWords } from './issueSearchQueries';

describe('jiraSearchJql', () => {
  it('lists the account’s open issues of the bound projects, most recently updated first, with no words', () => {
    expect(jiraSearchJql(['VCS', 'OPS'], {})).toBe('project in ("VCS", "OPS") AND assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
  });

  it('searches the titles for the words, the last one as a prefix', () => {
    expect(jiraSearchJql(['VCS'], { words: 'keep selec' })).toBe('project in ("VCS") AND summary ~ "keep selec*" ORDER BY updated DESC');
  });

  it('keeps the user’s words inside the one quoted string, so they never widen the search', () => {
    expect(jiraSearchJql(['VCS'], { words: '" OR project = OPS OR "' })).toBe('project in ("VCS") AND summary ~ "or project = ops or*" ORDER BY updated DESC');
  });
});

describe('jiraTitleWords', () => {
  it('drops what Jira’s text search reads as syntax: quotes, backslashes and Lucene’s reserved characters', () => {
    expect(jiraTitleWords('a"b\\c')).toBe('a b c*');
    expect(jiraTitleWords('+-&|!(){}[]^~*?:/ crash')).toBe('crash*');
  });

  it('lowers the case, so AND, OR and NOT are words, not operators', () => {
    expect(jiraTitleWords('Save AND Load NOT')).toBe('save and load not*');
  });

  it('keeps letters of any script', () => {
    expect(jiraTitleWords('Café 日本語')).toBe('café 日本語*');
  });

  it('is nothing when no word is left', () => {
    expect(jiraTitleWords(' "\\ ')).toBeNull();
  });
});

describe('githubSearchQuery', () => {
  it('lists the account’s open issues of the bound repositories, most recently updated first, with no words', () => {
    expect(githubSearchQuery(['acme/game', 'acme/tools'], {})).toBe('repo:acme/game repo:acme/tools is:issue sort:updated-desc is:open assignee:@me');
  });

  it('quotes each word, its quotes dropped, so a qualifier typed is a word', () => {
    expect(githubSearchQuery(['acme/game'], { words: 'crash repo:other "is:pr' })).toBe('repo:acme/game is:issue sort:updated-desc in:title "crash" "repo:other" "is:pr"');
  });

  it('keeps a backslash and any script inside the quotes', () => {
    expect(githubSearchQuery(['acme/game'], { words: 'C:\\temp ñandú' })).toBe('repo:acme/game is:issue sort:updated-desc in:title "C:\\temp" "ñandú"');
  });
});
