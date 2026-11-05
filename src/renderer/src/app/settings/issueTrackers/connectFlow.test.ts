import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { connectedTrackerOf, connectFailureWords, deviceCodeWords, linkReadBack, proofWords, signInStepFor, submitsOnPaste, suggestedEmail, suggestedTrackerLink } from './connectFlow';

const jira: TrackerConnection = { id: 'j', kind: 'jiraCloud', server: 'https://acme.atlassian.net', account: { id: '5b', name: 'Ana Díaz', email: 'ana@acme.com' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const setup = (connections: TrackerConnection[], deviceFlowHosts: string[] = []): IssueTrackerSetup => ({ connections, bindings: [{ repository: 'game@acme@unity', connectionId: 'j', projects: ['VCS'] }], sessionOnly: false, deviceFlowHosts });

describe('linkReadBack', () => {
  it('reads a pasted link back in words, sending nothing', () => {
    expect(linkReadBack('https://unity3d.atlassian.net/browse/VCS-1009139')).toMatchObject({ kind: 'read', words: 'Jira Cloud · unity3d.atlassian.net · project VCS' });
    expect(linkReadBack('https://github.com/acme/game/issues/12')).toMatchObject({ words: 'GitHub · github.com · acme/game' });
    expect(linkReadBack('https://git.acme.com/tools/build/issues/9')).toMatchObject({ words: 'GitHub Enterprise Server · git.acme.com · tools/build' });
  });

  it('says what a link that isn’t an issue is, and what to paste instead', () => {
    expect(linkReadBack('https://acme.atlassian.net/jira/software/projects/VCS/boards/7')).toEqual({ kind: 'problem', words: "That's a link to a Jira board, not an issue. Open any issue and copy its address." });
    expect(linkReadBack('https://example.com/x')).toMatchObject({ kind: 'problem' });
    expect(linkReadBack('  ')).toEqual({ kind: 'none' });
  });
});

describe('signInStepFor', () => {
  const link = (text: string) => {
    const read = linkReadBack(text);
    if (read.kind !== 'read') throw new Error('not read');
    return read.link;
  };

  it('offers the sign-in that already covers the link: one click, nothing to sign in again', () => {
    expect(signInStepFor(link('https://acme.atlassian.net/browse/OPS-3'), setup([jira]))).toEqual({ kind: 'useConnection', connection: jira, words: 'Jira at acme.atlassian.net · signed in as Ana Díaz' });
  });

  it('asks to sign in where none covers it, or the one there stopped working', () => {
    expect(signInStepFor(link('https://other.atlassian.net/browse/OPS-3'), setup([jira]))).toEqual({ kind: 'signIn', methods: ['token'], trackerName: 'Jira', needsEmail: true });
    expect(signInStepFor(link('https://acme.atlassian.net/browse/OPS-3'), setup([{ ...jira, credential: 'refused' }]))).toMatchObject({ kind: 'signIn' });
  });

  it('offers GitHub’s device flow first where it can', () => {
    expect(signInStepFor(link('https://github.com/acme/game/issues/1'), setup([], ['github.com']))).toEqual({ kind: 'signIn', methods: ['deviceCode', 'token'], trackerName: 'GitHub', needsEmail: false });
  });
});

describe('connectedTrackerOf', () => {
  it('names the repository’s tracker, projects and account', () => {
    expect(connectedTrackerOf(setup([jira]), 'game@acme@unity')).toEqual({ connection: jira, title: 'Jira at acme.atlassian.net', projects: 'Project VCS', account: 'Signed in as Ana Díaz' });
    expect(connectedTrackerOf(setup([jira]), 'other@acme@unity')).toBeNull();
  });

  it('asks to sign in again when the credential stopped working, and says a session-only one lasts until quitting', () => {
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'refused' }]), 'game@acme@unity')).toMatchObject({ signInAgain: 'Jira stopped accepting this sign-in.' });
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'missing' }]), 'game@acme@unity')).toMatchObject({ signInAgain: 'This computer no longer has the Jira sign-in.' });
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'session' }]), 'game@acme@unity')).toMatchObject({ sessionOnly: 'Kept until you quit: this computer has no keyring.' });
  });
});

describe('the token step', () => {
  it('signs in on paste only for a token of the tracker’s known shape', () => {
    expect(submitsOnPaste('github', ` ghp_${'a'.repeat(36)}\n`)).toBe(true);
    expect(submitsOnPaste('github', 'my-token-1234567890')).toBe(false);
    expect(submitsOnPaste('jiraCloud', `ATATT${'x'.repeat(40)}`)).toBe(true);
  });

  it('fills Jira’s email in with the cm user when that’s an address, else the one kept', () => {
    expect(suggestedEmail('ana@acme.com', undefined)).toBe('ana@acme.com');
    expect(suggestedEmail('ana', undefined)).toBe('');
    expect(suggestedEmail('ana@acme.com', 'kept@acme.com')).toBe('kept@acme.com');
  });
});

describe('proofWords', () => {
  it('names the project and its counts, never the pasted issue', () => {
    expect(proofWords({ kind: 'jiraCloud' }, { project: 'VCS', name: 'Version Control', openIssues: 214, assignedToYou: 6 })).toBe('Project VCS · 214 open issues, 6 assigned to you');
    expect(proofWords({ kind: 'github' }, { project: 'acme/game', name: 'acme/game', openIssues: 1 })).toBe('acme/game · 1 open issue');
    expect(proofWords({ kind: 'github' }, { project: 'acme/game', name: 'acme/game' })).toBe('acme/game');
  });
});

describe('connectFailureWords', () => {
  it('says what went wrong in a plain sentence, offering the token page where a new token helps', () => {
    expect(connectFailureWords({ reason: 'tokenRefused' }, { trackerName: 'Jira', email: 'ana@acme.com' })).toEqual({
      words: "Jira didn't accept this token for ana@acme.com. Check the email, or create a new token.",
      offersTokenPage: true,
    });
    expect(connectFailureWords({ reason: 'projectUnreadable', project: 'acme/game' }, { trackerName: 'GitHub' })).toEqual({
      words: "You're signed in, but acme/game can't be read with this sign-in. Check that the token can read it.",
      offersTokenPage: true,
    });
    expect(connectFailureWords({ reason: 'unreachable', server: 'https://acme.atlassian.net' }, { trackerName: 'Jira', server: 'https://acme.atlassian.net' }).words).toBe("Jira couldn't be reached at acme.atlassian.net.");
    expect(connectFailureWords({ reason: 'notGitHubEnterprise', server: 'https://git.acme.com' }, { trackerName: 'GitHub' }).words).toBe("This doesn't look like GitHub Enterprise Server.");
  });
});

describe('suggestedTrackerLink', () => {
  it('offers the tracker the branch comments link to most, counting each comment once', () => {
    const comments = [
      'Fixes https://unity3d.atlassian.net/browse/VCS-1 and https://unity3d.atlassian.net/browse/VCS-2.',
      'See https://unity3d.atlassian.net/browse/VCS-3',
      'Upstream: https://github.com/acme/game/issues/4',
      'No link here',
    ];
    expect(suggestedTrackerLink(comments)).toEqual({
      link: 'https://unity3d.atlassian.net/browse/VCS-1',
      words: 'Jira Cloud · unity3d.atlassian.net · project VCS',
      trackerName: 'Jira',
      seen: 'Seen in 2 branch comments',
    });
  });

  it('offers nothing when no comment links to an issue', () => {
    expect(suggestedTrackerLink(['https://example.com', 'https://acme.atlassian.net/jira/boards/1'])).toBeNull();
  });
});

describe('deviceCodeWords', () => {
  it('says where the copied code goes, and what the app waits for', () => {
    expect(deviceCodeWords({ verificationUri: 'https://github.com/login/device' }, 'GitHub')).toEqual({
      instruction: "Paste this code at github.com/login/device, opened in your browser. It's copied.",
      waiting: 'Waiting for GitHub…',
    });
  });
});
