import { describe, expect, it } from 'vitest';
import type { TrackerConnection } from '../domain/issueTrackers';
import type { RepositoryGuid } from '../domain/stableIds';
import { repositoryGuidFor } from '../testing/stableIdsFor';
import { bindingOf, issueReferenceReader } from './issueReferences';
import { deviceFlowHostsOf, GITHUB_APPS, signInMethodsFor } from './signInMethods';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraCloud', server: 'https://acme.atlassian.net', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const github: TrackerConnection = { ...jira, id: 'c2', kind: 'github', server: 'https://github.com', scope: '*' };
const GAME = repositoryGuidFor(1);

describe('issueReferenceReader', () => {
  it('takes an address as its issue only for an issue page of a bound project on the bound server', () => {
    const reader = issueReferenceReader({ repository: GAME, connectionId: 'c1', projects: ['VCS'] }, jira);
    expect(reader.issueAtAddress('https://acme.atlassian.net/browse/VCS-12')).toBe('VCS-12');
    expect(reader.issueAtAddress('https://ACME.atlassian.net/browse/VCS-12')).toBe('VCS-12');
    expect(reader.issueAtAddress('https://acme.atlassian.net/browse/OPS-12')).toBeNull();
    expect(reader.issueAtAddress('https://other.atlassian.net/browse/VCS-12')).toBeNull();
    expect(reader.issueAtAddress('https://acme.atlassian.net/secure/Dashboard.jspa?issue=VCS-12')).toBeNull();
    expect(reader.issueAtAddress('https://acme.atlassian.net/jira/boards/1?selectedIssue=VCS-12')).toBeNull();
  });

  it('takes a GitHub address of any repository on the bound server, as `owner/repo#12` names one', () => {
    const reader = issueReferenceReader({ repository: GAME, connectionId: 'c2', projects: ['Acme/Game'] }, github);
    expect(reader.issueAtAddress('https://github.com/acme/tools/issues/3')).toBe('acme/tools#3');
    expect(reader.referencesIn('#4').map(({ key }) => key)).toEqual(['acme/game#4']);
  });

  it('writes a picked issue as the grammar reads it back, its `#` kept as typed: `#VCS-12`, `#12` for the one repository bound', () => {
    const jiraReader = issueReferenceReader({ repository: GAME, connectionId: 'c1', projects: ['VCS', 'OPS'] }, jira);
    expect(jiraReader.referenceText('VCS-12')).toBe('#VCS-12');
    const one = issueReferenceReader({ repository: GAME, connectionId: 'c2', projects: ['Acme/Game'] }, github);
    expect(one.referenceText('acme/game#12')).toBe('#12');
    expect(one.referenceText('acme/tools#3')).toBe('acme/tools#3');
    const two = issueReferenceReader({ repository: GAME, connectionId: 'c2', projects: ['acme/game', 'acme/tools'] }, github);
    expect(two.referenceText('acme/game#12')).toBe('acme/game#12');
    // Each reads back as the issue picked.
    expect(jiraReader.referencesIn(jiraReader.referenceText('VCS-12')).map((found) => found.key)).toEqual(['VCS-12']);
    expect(one.referencesIn(one.referenceText('acme/game#12')).map((found) => found.key)).toEqual(['acme/game#12']);
    expect(two.referencesIn(two.referenceText('acme/tools#3')).map((found) => found.key)).toEqual(['acme/tools#3']);
  });

  it('reads the key a text typed after `#` names: a key of a bound project, or a number when one project is bound', () => {
    const jiraReader = issueReferenceReader({ repository: GAME, connectionId: 'c1', projects: ['VCS'] }, jira);
    expect(jiraReader.keyTyped('VCS-12')).toBe('VCS-12');
    expect(jiraReader.keyTyped('vcs-12')).toBe('VCS-12');
    expect(jiraReader.keyTyped('12')).toBe('VCS-12');
    expect(jiraReader.keyTyped('OPS-12')).toBeNull();
    expect(jiraReader.keyTyped('VCS-')).toBeNull();
    expect(jiraReader.keyTyped('VCS-012')).toBeNull();
    expect(jiraReader.keyTyped('selection')).toBeNull();
    const twoProjects = issueReferenceReader({ repository: GAME, connectionId: 'c1', projects: ['VCS', 'OPS'] }, jira);
    expect(twoProjects.keyTyped('12')).toBeNull();
    expect(twoProjects.keyTyped('OPS-7')).toBe('OPS-7');
    const one = issueReferenceReader({ repository: GAME, connectionId: 'c2', projects: ['Acme/Game'] }, github);
    expect(one.keyTyped('12')).toBe('acme/game#12');
    expect(one.keyTyped('0')).toBeNull();
    const two = issueReferenceReader({ repository: GAME, connectionId: 'c2', projects: ['acme/game', 'acme/tools'] }, github);
    expect(two.keyTyped('12')).toBeNull();
  });
});

describe('bindingOf', () => {
  it('matches a repository by its GUID, never a binding still kept by its spec', () => {
    const bindings = [
      { repository: GAME, connectionId: 'c1', projects: ['VCS'] },
      { repository: 'tools@acme@unity' as RepositoryGuid, connectionId: 'c2', projects: ['OPS'] },
    ];
    expect(bindingOf(bindings, GAME)?.connectionId).toBe('c1');
    expect(bindingOf(bindings, repositoryGuidFor(2))).toBeUndefined();
  });
});

describe('signInMethodsFor', () => {
  it('offers GitHub’s device flow first where an app is registered for the host, a token otherwise', () => {
    expect(signInMethodsFor('github', 'https://github.com', ['github.com'])).toEqual(['deviceCode', 'token']);
    expect(signInMethodsFor('github', 'https://github.com', [])).toEqual(['token']);
    expect(signInMethodsFor('github', 'https://git.acme.com', ['github.com'])).toEqual(['token']);
  });

  it('offers Jira Cloud a token', () => {
    expect(signInMethodsFor('jiraCloud', 'https://acme.atlassian.net', ['github.com'])).toEqual(['token']);
  });

  it('names the hosts with a client id', () => {
    expect(deviceFlowHostsOf({ 'github.com': { clientId: '' } })).toEqual([]);
    expect(deviceFlowHostsOf({ 'github.com': { clientId: 'Iv1.abc' } })).toEqual(['github.com']);
  });

  it('ships the app’s client id for github.com, so signing in to GitHub starts with its device flow', () => {
    expect(deviceFlowHostsOf(GITHUB_APPS)).toEqual(['github.com']);
  });
});
