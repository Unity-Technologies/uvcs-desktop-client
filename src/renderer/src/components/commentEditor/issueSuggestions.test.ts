import { describe, expect, it } from 'vitest';
import type { Issue, IssueSearchAnswer, TrackerConnection } from '@shared/domain/issueTrackers';
import { issueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { issueSearchStaleTime, issueSuggestionReads, issueSuggestionRows, ISSUE_SEARCH_FRESH_MS, ISSUE_SEARCH_RETRY_MS, type IssueListState } from './issueSuggestions';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraCloud', server: 'https://acme.atlassian.net', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const github: TrackerConnection = { ...jira, id: 'c2', kind: 'github', server: 'https://github.com', scope: '*' };
const jiraReader = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }, jira);
const githubReader = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c2', projects: ['acme/game'] }, github);

function issue(key: string, title: string, statusCategory: Issue['statusCategory'] = 'todo'): Issue {
  return { key, title, status: 'Open', statusCategory, type: 'Bug', assignee: null, url: `https://acme.atlassian.net/browse/${key}` };
}

const MINE = [issue('VCS-12', 'Keep the selection when the layout changes', 'inProgress'), issue('VCS-7', 'Crash on start'), issue('VCS-120', 'Faster branch list')];
const found = (issues: Issue[]): IssueSearchAnswer => ({ kind: 'found', connectionId: 'c1', issues });

function state(overrides: Partial<IssueListState> = {}): IssueListState {
  return { typed: '', reader: jiraReader, trackerName: 'Jira', needsSignIn: false, mine: { answer: found(MINE), pending: false }, words: null, keyed: null, ...overrides };
}

const labels = (rows: ReturnType<typeof issueSuggestionRows>) => rows.map((row) => (row.kind === 'pick' ? row.suggestion.label : row.kind === 'note' ? `(${row.text})` : row.kind));

describe('issueSuggestionReads', () => {
  it('reads nothing more while typing, nor for `#` alone: the account’s open issues are read anyway', () => {
    expect(issueSuggestionReads(jiraReader, '', '')).toEqual({ words: null, key: null });
    expect(issueSuggestionReads(jiraReader, 'crash', 'cras')).toEqual({ words: null, key: null });
  });

  it('reads a key or a number typed as one issue, never searching it', () => {
    expect(issueSuggestionReads(jiraReader, 'VCS-99', 'VCS-99')).toEqual({ words: null, key: 'VCS-99' });
    expect(issueSuggestionReads(jiraReader, '99', '99')).toEqual({ words: null, key: 'VCS-99' });
    expect(issueSuggestionReads(githubReader, '4', '4')).toEqual({ words: null, key: 'acme/game#4' });
  });

  it('searches words once settled and from three characters, never a number alone', () => {
    expect(issueSuggestionReads(jiraReader, 'cr', 'cr')).toEqual({ words: null, key: null });
    expect(issueSuggestionReads(jiraReader, 'crash', 'crash')).toEqual({ words: 'crash', key: null });
    expect(issueSuggestionReads(githubReader, 'ña', 'ña')).toEqual({ words: null, key: null });
    const twoProjects = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS', 'OPS'] }, jira);
    expect(issueSuggestionReads(twoProjects, '123', '123')).toEqual({ words: null, key: null });
  });
});

describe('issueSuggestionRows', () => {
  it('opens on the account’s open issues, in the tracker’s order, each with its title and status', () => {
    const rows = issueSuggestionRows(state());
    expect(labels(rows)).toEqual(['#VCS-12', '#VCS-7', '#VCS-120']);
    expect(rows[0]).toEqual({ kind: 'pick', suggestion: expect.objectContaining({ key: 'issue:VCS-12', kind: 'issue', detail: 'Keep the selection when the layout changes', category: 'inProgress', insert: '#VCS-12' }) });
  });

  it('narrows by key, number or title words as the user types', () => {
    expect(labels(issueSuggestionRows(state({ typed: 'VCS-12' })))).toEqual(['#VCS-12', '#VCS-120']);
    expect(labels(issueSuggestionRows(state({ typed: '7' })))).toEqual(['#VCS-7']);
    expect(labels(issueSuggestionRows(state({ typed: 'crash' })))).toEqual(['#VCS-7']);
  });

  it('writes GitHub’s issue as `#12` for the one repository bound', () => {
    const issues = [{ ...issue('acme/game#12', 'Crash'), url: 'https://github.com/acme/game/issues/12' }];
    const rows = issueSuggestionRows(state({ reader: githubReader, trackerName: 'GitHub', mine: { answer: { kind: 'found', connectionId: 'c2', issues }, pending: false } }));
    expect(rows).toEqual([{ kind: 'pick', suggestion: expect.objectContaining({ label: '#12', insert: '#12' }) }]);
  });

  it('puts the issue a key names first, then the matches, then what the title search found, each once', () => {
    const keyed = { key: 'VCS-99', read: { key: 'VCS-99', kind: 'found' as const, issue: issue('VCS-99', 'Old crash') } };
    expect(labels(issueSuggestionRows(state({ typed: 'VCS-99', keyed })))).toEqual(['#VCS-99']);
    const words = { answer: found([issue('VCS-7', 'Crash on start'), issue('VCS-300', 'Crash in the diff')]), pending: false };
    expect(labels(issueSuggestionRows(state({ typed: 'crash', words })))).toEqual(['#VCS-7', '#VCS-300']);
  });

  it('says it’s reading while nothing can be picked yet, and keeps what it has while a search runs', () => {
    expect(issueSuggestionRows(state({ mine: { answer: undefined, pending: true } }))).toEqual([{ kind: 'note', text: 'Reading issues…', pending: true }]);
    expect(labels(issueSuggestionRows(state({ typed: 'crash', words: { answer: undefined, pending: true } })))).toEqual(['#VCS-7']);
    expect(labels(issueSuggestionRows(state({ typed: 'diff', words: { answer: { kind: 'superseded' }, pending: false } })))).toEqual(['(Reading issues…)']);
    expect(labels(issueSuggestionRows(state({ typed: 'VCS-99', keyed: { key: 'VCS-99', read: undefined } })))).toEqual(['(Reading issues…)']);
  });

  it('says what it found when nothing matches', () => {
    expect(labels(issueSuggestionRows(state({ mine: { answer: found([]), pending: false } })))).toEqual(['(No open issues assigned to you)']);
    expect(labels(issueSuggestionRows(state({ typed: 'zebra', words: { answer: found([]), pending: false } })))).toEqual(['(No issues match “zebra”)']);
    expect(labels(issueSuggestionRows(state({ typed: 'VCS-99', keyed: { key: 'VCS-99', read: { key: 'VCS-99', kind: 'missing' } } })))).toEqual(['(No issue VCS-99)']);
  });

  it('says once, quietly, that the search failed, keeping what it could show', () => {
    const failed = { answer: { kind: 'failed' as const, reason: 'unreachable' as const }, pending: false };
    expect(labels(issueSuggestionRows(state({ mine: failed })))).toEqual(["(Couldn't search Jira)"]);
    expect(labels(issueSuggestionRows(state({ typed: 'crash', words: failed })))).toEqual(['#VCS-7', "(Couldn't search Jira)"]);
  });

  it('sends a sign-in that needs renewing to Settings, with nothing else', () => {
    expect(labels(issueSuggestionRows(state({ needsSignIn: true })))).toEqual(['(Sign in to Jira again in Settings)']);
    const refused = { answer: { kind: 'failed' as const, reason: 'signInRefused' as const }, pending: false };
    expect(labels(issueSuggestionRows(state({ mine: refused })))).toEqual(['(Sign in to Jira again in Settings)']);
  });
});

describe('issueSearchStaleTime', () => {
  it('keeps what was found a minute, a failure until it may be tried again, a replaced search not at all', () => {
    expect(issueSearchStaleTime(found([]), 0)).toBe(ISSUE_SEARCH_FRESH_MS);
    expect(issueSearchStaleTime({ kind: 'failed', reason: 'unreachable' }, 0)).toBe(ISSUE_SEARCH_RETRY_MS);
    expect(issueSearchStaleTime({ kind: 'failed', reason: 'rateLimited', retryAt: 11_000 }, 1_000)).toBe(10_000);
    expect(issueSearchStaleTime({ kind: 'superseded' }, 0)).toBe(0);
    expect(issueSearchStaleTime(undefined, 0)).toBe(0);
  });
});
