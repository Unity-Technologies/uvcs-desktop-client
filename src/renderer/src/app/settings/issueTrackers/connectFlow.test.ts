import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { otherTokenPageOffered, accountWords, clearsClipboardAfter, connectedTrackerOf, connectFailureWords, deviceCodeWords, linkReadBack, addProjectReady, signInAgainStep, signInAgainView, signInMethodShown, signInRows, tokenStepReady, tokenStepWords, proofWords, signInStepFor, submitsOnPaste, suggestedEmail, suggestedTrackerLink } from './connectFlow';

const jira: TrackerConnection = { id: 'j', kind: 'jiraCloud', server: 'https://acme.atlassian.net', account: { id: '5b', name: 'Ana Díaz', email: 'ana@acme.com' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const setup = (connections: TrackerConnection[], deviceFlowHosts: string[] = []): IssueTrackerSetup => ({ connections, bindings: [{ repository: 'game@acme@unity', connectionId: 'j', projects: ['VCS'] }], sessionOnly: false, deviceFlowHosts });

describe('linkReadBack', () => {
  it('reads a Jira Data Center link back as Data Center', () => {
    expect(linkReadBack('https://jira.unity3d.com/browse/VCS-1009081')).toMatchObject({ kind: 'read', words: 'Jira Data Center · jira.unity3d.com · project VCS' });
  });

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
    expect(signInStepFor(link('https://other.atlassian.net/browse/OPS-3'), setup([jira]))).toEqual({ kind: 'signIn', methods: ['token'], trackerName: 'Jira' });
    expect(signInStepFor(link('https://acme.atlassian.net/browse/OPS-3'), setup([{ ...jira, credential: 'refused' }]))).toMatchObject({ kind: 'signIn' });
  });

  it('offers GitHub’s device flow first where it can', () => {
    expect(signInStepFor(link('https://github.com/acme/game/issues/1'), setup([], ['github.com']))).toEqual({ kind: 'signIn', methods: ['deviceCode', 'token'], trackerName: 'GitHub' });
  });
});

describe('connectedTrackerOf', () => {
  it('names the repository’s tracker, projects and account', () => {
    expect(connectedTrackerOf(setup([jira]), 'game@acme@unity')).toEqual({ connection: jira, title: 'Jira at acme.atlassian.net', projects: 'Project VCS', account: 'Signed in as Ana Díaz' });
    expect(connectedTrackerOf(setup([jira]), 'other@acme@unity')).toBeNull();
  });

  it('asks to sign in again when the credential stopped working, and says a session-only one lasts until quitting', () => {
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'refused' }]), 'game@acme@unity')).toMatchObject({ signInAgain: 'Jira stopped accepting this sign-in.', account: 'Needs signing in again' });
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
    expect(connectFailureWords({ reason: 'sentToLogin', server: 'https://jira.unity3d.com' }, { trackerName: 'Jira' })).toEqual({
      words: 'Jira sent this sign-in to its login page at jira.unity3d.com. Check the token, or create a new one.',
      offersTokenPage: true,
    });
    expect(connectFailureWords({ reason: 'hostDeclined', server: 'https://git.acme.com' }, { trackerName: 'GitHub' }).words).toBe("Not signed in: git.acme.com wasn't allowed.");
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

describe('the token step’s words and readiness', () => {
  it('asks Jira for the email its token goes with, and says the app only reads issues with a token', () => {
    expect(tokenStepWords('jiraCloud')).toEqual({ tokenLabel: 'Jira API token', emailLabel: 'Your Atlassian account email', hint: 'Made on your Atlassian account’s Security page. The app only reads issues with it.' });
    expect(tokenStepWords('github')).toEqual({ tokenLabel: 'GitHub token', hint: 'The app only reads issues with it.' });
    expect(tokenStepWords('jiraDataCenter')).toEqual({ tokenLabel: 'Jira token', hint: 'The app only reads issues with it.' });
    expect(tokenStepReady('jiraDataCenter', '', 'token', false)).toBe(true);
  });

  it('can sign in with a token given, Jira’s email too, and never while signing in', () => {
    expect(tokenStepReady('jiraCloud', ' ', 'token', false)).toBe(false);
    expect(tokenStepReady('jiraCloud', 'ana@acme.com', 'token', false)).toBe(true);
    expect(tokenStepReady('github', '', 'token', false)).toBe(true);
    expect(tokenStepReady('github', '', '  ', false)).toBe(false);
    expect(tokenStepReady('github', '', 'token', true)).toBe(false);
  });

  it('shows the server’s best way to sign in, unless a token was chosen', () => {
    expect(signInMethodShown(['deviceCode', 'token'], false)).toBe('deviceCode');
    expect(signInMethodShown(['deviceCode', 'token'], true)).toBe('token');
    expect(signInMethodShown(['token'], false)).toBe('token');
  });

  it('adds a project by a link that reads as an issue', () => {
    expect(addProjectReady('https://github.com/acme/tools/issues/1')).toBe(true);
    expect(addProjectReady('  ')).toBe(false);
    expect(addProjectReady('https://github.com/acme/tools')).toBe(false);
  });
});

describe('signInAgainStep', () => {
  it('asks for a new credential only when the tracker refused the one kept, by the server’s best method', () => {
    expect(signInAgainStep({ kind: 'github', server: 'https://github.com' }, { reason: 'tokenRefused' }, ['github.com'])).toEqual({ kind: 'askCredential', methods: ['deviceCode', 'token'] });
    expect(signInAgainStep({ kind: 'jiraCloud', server: 'https://acme.atlassian.net' }, { reason: 'tokenRefused' }, [])).toEqual({ kind: 'askCredential', methods: ['token'] });
  });

  it('keeps the credential when the tracker is out of reach or asked to wait, saying so', () => {
    expect(signInAgainStep({ kind: 'jiraCloud', server: 'https://acme.atlassian.net' }, { reason: 'unreachable', server: 'https://acme.atlassian.net' }, [])).toEqual({
      kind: 'problem',
      words: "Jira couldn't be reached at acme.atlassian.net.",
    });
    expect(signInAgainStep({ kind: 'github', server: 'https://github.com' }, { reason: 'rateLimited' }, [])).toMatchObject({ kind: 'problem' });
  });
});

describe('clearsClipboardAfter', () => {
  it('empties the clipboard only after signing in with a pasted token', () => {
    expect(clearsClipboardAfter(true, { kind: 'signedIn' })).toBe(true);
    expect(clearsClipboardAfter(true, { kind: 'failed' })).toBe(false);
    expect(clearsClipboardAfter(false, { kind: 'signedIn' })).toBe(false);
  });
});

describe('signInAgainView', () => {
  it('starts with why and “Sign in again”, says “Try again” after a try that couldn’t reach the tracker, then signs in', () => {
    expect(signInAgainView(null, 'Jira stopped accepting this sign-in.', false)).toEqual({ kind: 'retry', words: 'Jira stopped accepting this sign-in.', button: 'Sign in again' });
    expect(signInAgainView({ kind: 'problem', words: "Jira couldn't be reached at acme.atlassian.net." }, 'why', false)).toEqual({ kind: 'retry', words: "Jira couldn't be reached at acme.atlassian.net.", button: 'Try again' });
    expect(signInAgainView({ kind: 'askCredential', methods: ['deviceCode', 'token'] }, 'why', false)).toEqual({ kind: 'deviceCode' });
    expect(signInAgainView({ kind: 'askCredential', methods: ['deviceCode', 'token'] }, 'why', true)).toEqual({ kind: 'token' });
  });
});

describe('signInRows', () => {
  it('lists each sign-in with its tracker and account, or that it needs signing in again', () => {
    expect(signInRows(setup([jira, { ...jira, id: 'r', credential: 'refused' }]))).toEqual([
      { id: 'j', title: 'Jira at acme.atlassian.net', account: 'Signed in as Ana Díaz', signOut: 'Sign out of acme.atlassian.net' },
      { id: 'r', title: 'Jira at acme.atlassian.net', account: 'Needs signing in again', signOut: 'Sign out of acme.atlassian.net' },
    ]);
    expect(accountWords({ ...jira, credential: 'missing' })).toBe('Needs signing in again');
    expect(signInRows(undefined)).toEqual([]);
  });
});

describe('otherTokenPageOffered', () => {
  it('offers the other token page only where a tracker has two: Jira Data Center, its own and an app’s', () => {
    expect(otherTokenPageOffered('jiraDataCenter')).toBe(true);
    expect(otherTokenPageOffered('jiraCloud')).toBe(false);
    expect(otherTokenPageOffered('github')).toBe(false);
  });
});
