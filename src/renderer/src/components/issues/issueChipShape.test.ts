import { describe, expect, it } from 'vitest';
import type { Issue, IssueRead, IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { issueCard, issueChipShape } from './issueChipShape';
import { connectionsToReread, issueStaleTime, ISSUE_FRESH_MS } from './issueQueries';
import { placeTrackerOf } from './placeTracker';

const ISSUE: Issue = { key: 'VCS-12', title: 'Keep the selection', status: 'In Progress', statusCategory: 'inProgress', type: 'Bug', assignee: { id: 'l', name: 'Lena Marsh' }, url: 'https://x.atlassian.net/browse/VCS-12' };
const found: IssueRead = { key: 'VCS-12', kind: 'found', issue: ISSUE };
const jira = { kind: 'jiraCloud' as const, credential: 'kept' as const };

describe('issueChipShape', () => {
  it('shows a key as a chip, with its title in a full comment and its status’s category', () => {
    expect(issueChipShape({ key: 'VCS-12', bare: false }, 'VCS-12', 'jiraCloud', found, false)).toEqual({ kind: 'chip', label: 'VCS-12', title: 'Jira issue VCS-12', summary: 'Keep the selection', category: 'inProgress' });
    expect(issueChipShape({ key: 'VCS-12', bare: false }, 'VCS-12', 'jiraCloud', found, true)).toEqual({ kind: 'chip', label: 'VCS-12', title: 'Jira issue VCS-12', category: 'inProgress' });
  });

  it('keeps a key the tracker reports missing a chip, as a changeset’s', () => {
    expect(issueChipShape({ key: 'VCS-99', bare: false }, 'VCS-99', 'jiraCloud', { key: 'VCS-99', kind: 'missing' }, false)).toEqual({ kind: 'chip', label: 'VCS-99', title: 'Jira issue VCS-99' });
  });

  it('shows a bare `#12` as text until read as found, and as text in a row always', () => {
    const bare = { key: 'acme/game#12', bare: true };
    const pull: IssueRead = { key: 'acme/game#12', kind: 'found', issue: { ...ISSUE, key: 'acme/game#12', type: 'Pull request' } };
    expect(issueChipShape(bare, '#12', 'github', undefined, false)).toEqual({ kind: 'text' });
    expect(issueChipShape(bare, '#12', 'github', { key: 'acme/game#12', kind: 'missing' }, false)).toEqual({ kind: 'text' });
    expect(issueChipShape(bare, '#12', 'github', pull, false)).toMatchObject({ kind: 'chip', label: '#12', title: 'Pull request acme/game#12' });
    expect(issueChipShape(bare, '#12', 'github', pull, true)).toEqual({ kind: 'text' });
  });
});

describe('issueCard', () => {
  const reference = { key: 'VCS-12', bare: false };

  it('leads with the title, then the status, type and assignee', () => {
    expect(issueCard(reference, jira, found)).toEqual({ comment: 'Keep the selection', title: 'Jira issue VCS-12', meta: ['Jira issue VCS-12', 'In Progress', 'Bug', 'Lena Marsh'] });
    expect(issueCard(reference, jira, { ...found, issue: { ...ISSUE, assignee: null, type: 'Issue' } }).meta).toEqual(['Jira issue VCS-12', 'In Progress', 'Unassigned']);
  });

  it('says why there is nothing to show', () => {
    expect(issueCard(reference, { ...jira, credential: 'refused' }, undefined).meta).toEqual(['Sign in to Jira again to see it']);
    expect(issueCard(reference, jira, { key: 'VCS-12', kind: 'missing' }).meta).toEqual(['No issue VCS-12']);
    expect(issueCard(reference, jira, { key: 'VCS-12', kind: 'noAccess' }).meta).toEqual(["Your Jira sign-in can't see it"]);
    expect(issueCard(reference, jira, { key: 'VCS-12', kind: 'unreadable', reason: 'rateLimited' }).meta).toEqual(['Jira asked to wait: it shows again in a while']);
    expect(issueCard(reference, jira, { key: 'VCS-12', kind: 'unreadable', reason: 'unreachable' }).meta).toEqual(["Jira couldn't be reached"]);
  });
});

describe('issueStaleTime', () => {
  it('keeps a read five minutes, a missing one too, and a failure until it may be tried again', () => {
    expect(issueStaleTime(found, 0)).toBe(ISSUE_FRESH_MS);
    expect(issueStaleTime({ key: 'VCS-1', kind: 'missing' }, 0)).toBe(ISSUE_FRESH_MS);
    expect(issueStaleTime({ key: 'VCS-1', kind: 'unreadable', reason: 'unexpected' }, 0)).toBe(5 * 60_000);
    expect(issueStaleTime({ key: 'VCS-1', kind: 'unreadable', reason: 'rateLimited', retryAt: 61_000 }, 1_000)).toBe(60_000);
    expect(issueStaleTime({ key: 'VCS-1', kind: 'unreadable', reason: 'rateLimited', retryAt: 0 }, 1_000)).toBe(0);
  });
});

const connection: TrackerConnection = { id: 'c1', kind: 'jiraCloud', server: 'https://x.atlassian.net', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const setup = (connections: TrackerConnection[]): IssueTrackerSetup => ({ connections, bindings: [{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }], sessionOnly: false, deviceFlowHosts: [] });

describe('connectionsToReread', () => {
  it('reads a connection’s issues again when its sign-in changed, not when nothing did', () => {
    expect(connectionsToReread(setup([connection]), setup([{ ...connection, credential: 'refused' }]))).toEqual(['c1']);
    expect(connectionsToReread(setup([connection]), setup([connection]))).toEqual([]);
    expect(connectionsToReread(undefined, setup([connection]))).toEqual([]);
  });
});

describe('placeTrackerOf', () => {
  it('finds the place’s repository’s tracker, and none for another repository or before the setup is read', () => {
    expect(placeTrackerOf(setup([connection]), 'game@acme@unity')?.connection.id).toBe('c1');
    expect(placeTrackerOf(setup([connection]), 'other@acme@unity')).toBeNull();
    expect(placeTrackerOf(undefined, 'game@acme@unity')).toBeNull();
  });
});
