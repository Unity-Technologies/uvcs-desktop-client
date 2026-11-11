import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { otherTokenPageOffered, clearsClipboardAfter, connectedTrackerOf, connectFailureWords, deviceCodeWords, linkReadBack, addProjectReady, signInAgainStep, signInAgainView, signInMethodShown, signInForView, connectsWithSignIn, connectStage, pickedSignInShown, repositoryTrackerView, signInRows, tokenStepReady, usableSignIns, tokenStepWords, signInStepFor, suggestedEmail, suggestedTrackerLink, type SignInStep } from './connectFlow';

const jira: TrackerConnection = { id: 'j', kind: 'jiraCloud', server: 'https://acme.atlassian.net', account: { id: '5b', name: 'Ana Díaz', email: 'ana@acme.com' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const setup = (connections: TrackerConnection[], deviceFlowHosts: string[] = []): IssueTrackerSetup => ({ connections, bindings: [{ repository: 'game@acme@unity', connectionId: 'j', projects: ['VCS'] }], sessionOnly: false, deviceFlowHosts });

describe('linkReadBack', () => {
  it('reads a link back in parts too: the kind for a badge, the host, the project', () => {
    expect(linkReadBack('https://jira.acme.com/browse/VCS-1004321')).toMatchObject({ parts: { kindName: 'Jira Data Center', host: 'jira.acme.com', projectNoun: 'project', project: 'VCS' } });
    expect(linkReadBack('https://github.com/acme/game/issues/12')).toMatchObject({ parts: { kindName: 'GitHub', host: 'github.com', project: 'acme/game' } });
  });

  it('reads a Jira Data Center link back as Data Center', () => {
    expect(linkReadBack('https://jira.acme.com/browse/VCS-1004321')).toMatchObject({ kind: 'read', words: 'Jira Data Center · jira.acme.com · project VCS' });
  });

  it('reads a pasted link back in words, sending nothing', () => {
    expect(linkReadBack('https://acme.atlassian.net/browse/VCS-1001234')).toMatchObject({ kind: 'read', words: 'Jira Cloud · acme.atlassian.net · project VCS' });
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

  it('signs in with a different account when asked, even where a sign-in covers the link', () => {
    expect(signInStepFor(link('https://acme.atlassian.net/browse/OPS-3'), setup([jira]), { differentAccount: true })).toEqual({
      kind: 'signIn',
      methods: ['token'],
      trackerName: 'Jira',
      replacesWords: "Signing in here replaces Ana Díaz's sign-in, for every repository that uses it.",
    });
    // On GitHub a token's reach decides whether it replaces the kept one (a fine-grained token is a sign-in of its own): no promise.
    const github: TrackerConnection = { ...jira, id: 'g', kind: 'github', server: 'https://github.com', scope: '*' };
    expect(signInStepFor(link('https://github.com/acme/game/issues/1'), setup([github]), { differentAccount: true })).toEqual({ kind: 'signIn', methods: ['token'], trackerName: 'GitHub' });
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
    expect(connectedTrackerOf(setup([jira]), 'game@acme@unity')).toEqual({ connection: jira, projectKeys: ['VCS'] });
    expect(connectedTrackerOf(setup([jira]), 'other@acme@unity')).toBeNull();
  });

  it('asks to sign in again when the credential stopped working, and says a session-only one lasts until quitting', () => {
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'refused' }]), 'game@acme@unity')).toMatchObject({ signInAgain: 'Jira stopped accepting this sign-in.' });
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'missing' }]), 'game@acme@unity')).toMatchObject({ signInAgain: 'This computer no longer has the Jira sign-in.' });
    expect(connectedTrackerOf(setup([{ ...jira, credential: 'session' }]), 'game@acme@unity')).toMatchObject({ sessionOnly: 'Kept until you quit: this computer has no keyring.' });
  });
});

describe('the token step', () => {
  it('fills Jira’s email in with the cm user when that’s an address, else the one kept', () => {
    expect(suggestedEmail('ana@acme.com', undefined)).toBe('ana@acme.com');
    expect(suggestedEmail('ana', undefined)).toBe('');
    expect(suggestedEmail('ana@acme.com', 'kept@acme.com')).toBe('kept@acme.com');
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
    // Signed in with the GitHub App, which reads a private repository only where it's installed.
    const installPage = 'https://github.com/apps/acme-desktop/installations/new';
    expect(connectFailureWords({ reason: 'projectUnreadable', project: 'acme/game', installPage }, { trackerName: 'GitHub' })).toEqual({
      words: "You're signed in, but acme/game can't be read. If it's private, add the Unity Version Control Desktop app to acme on GitHub.",
      offersTokenPage: false,
      installPage,
    });
    expect(connectFailureWords({ reason: 'unreachable', server: 'https://acme.atlassian.net' }, { trackerName: 'Jira', server: 'https://acme.atlassian.net' }).words).toBe("Jira couldn't be reached at acme.atlassian.net.");
    expect(connectFailureWords({ reason: 'notGitHubEnterprise', server: 'https://git.acme.com' }, { trackerName: 'GitHub' }).words).toBe("This doesn't look like GitHub Enterprise Server.");
    expect(connectFailureWords({ reason: 'sentToLogin', server: 'https://jira.acme.com' }, { trackerName: 'Jira' })).toEqual({
      words: 'Jira sent this sign-in to its login page at jira.acme.com. Check the token, or create a new one.',
      offersTokenPage: true,
    });
    expect(connectFailureWords({ reason: 'hostDeclined', server: 'https://git.acme.com' }, { trackerName: 'GitHub' }).words).toBe("Not signed in: git.acme.com wasn't allowed.");
  });
});

describe('suggestedTrackerLink', () => {
  it('offers the tracker the branch comments link to most, counting each comment once', () => {
    const comments = [
      'Fixes https://acme.atlassian.net/browse/VCS-1 and https://acme.atlassian.net/browse/VCS-2.',
      'See https://acme.atlassian.net/browse/VCS-3',
      'Upstream: https://github.com/acme/game/issues/4',
      'No link here',
    ];
    expect(suggestedTrackerLink(comments)).toEqual({
      link: 'https://acme.atlassian.net/browse/VCS-1',
      words: 'Jira Cloud · acme.atlassian.net · project VCS',
      trackerName: 'Jira',
      choice: 'jira',
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
    expect(tokenStepWords('jiraCloud')).toMatchObject({ getTitle: 'Get a token from Atlassian', createButton: 'Open Atlassian', tokenLabel: 'Jira API token', emailLabel: 'Your Atlassian account email', createWhere: 'Create an API token with any name and copy it. The app only reads issues with it.' });
    expect(tokenStepWords('github')).toMatchObject({ getTitle: 'Get a token from GitHub', createButton: 'Open GitHub', tokenLabel: 'GitHub token' });
    expect(tokenStepWords('github').createWhere).toContain('The app only reads issues with it.');
    expect(tokenStepWords('jiraDataCenter')).toMatchObject({ getTitle: 'Get a token from Jira', createButton: 'Open Jira', tokenLabel: 'Jira token' });
    expect(tokenStepWords('jiraDataCenter').emailLabel).toBeUndefined();
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

  it('keeps a sign-in’s failure on screen once the sign-in, kept though its project couldn’t be read, turns the step into using it', () => {
    const failure = { reason: 'projectUnreadable', project: 'acme/game', installPage: 'https://github.com/apps/acme-desktop/installations/new' } as const;
    const useIt: SignInStep = { kind: 'useConnection', connection: { ...jira, kind: 'github', server: 'https://github.com' }, words: '' };
    expect(signInForView(useIt, 'game@acme@unity', false, failure)).toMatchObject({ kind: 'useConnection', failure });
    expect(signInForView(useIt, undefined, false, failure)).toMatchObject({ kind: 'alreadySignedIn', failure });
    expect(signInForView(useIt, undefined, false, null)).toMatchObject({ kind: 'alreadySignedIn', failure: null });
  });

  it('shows a failed sign-in under the device flow; the token step words its own', () => {
    const failure = { reason: 'denied' } as const;
    const signIn: SignInStep = { kind: 'signIn', methods: ['deviceCode', 'token'], trackerName: 'GitHub' };
    expect(signInForView(signIn, undefined, false, failure)).toMatchObject({ kind: 'signIn', method: 'deviceCode', failure });
    expect(signInForView(signIn, undefined, true, failure)).toMatchObject({ kind: 'signIn', method: 'token', failure: null });
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
  it('lists each sign-in with its tracker, account and how it stands, marking the one this repository uses', () => {
    const rows = signInRows(setup([jira, { ...jira, id: 'r', credential: 'refused' }]), 'game@acme@unity');
    expect(rows.map((row) => row.detail)).toEqual(['acme.atlassian.net · This repository', 'acme.atlassian.net']);
    expect(rows.map(({ id, title, account, host, status, needsAttention, usedHere, signOut }) => ({ id, title, account, host, status, needsAttention, usedHere, signOut }))).toEqual([
      { id: 'j', title: 'Jira at acme.atlassian.net', account: 'Ana Díaz', host: 'acme.atlassian.net', status: { tone: 'positive', label: 'Signed in' }, needsAttention: false, usedHere: true, signOut: 'Sign out of acme.atlassian.net' },
      { id: 'r', title: 'Jira at acme.atlassian.net', account: 'Ana Díaz', host: 'acme.atlassian.net', status: { tone: 'caution', label: 'Needs sign-in' }, needsAttention: true, usedHere: false, signOut: 'Sign out of acme.atlassian.net' },
    ]);
    expect(signInRows(setup([jira])).map((row) => row.usedHere)).toEqual([false]);
    expect(signInRows(undefined)).toEqual([]);
  });

  it('asks before signing out, saying which repositories lose their tracker', () => {
    const [used, unused] = signInRows(setup([jira, { ...jira, id: 'r' }]));
    expect(used!.signOutQuestion).toEqual({
      title: 'Sign out of Jira at acme.atlassian.net?',
      message: 'This computer forgets the Jira sign-in, and 1 repository using it goes back to showing issues as plain text.',
      confirmLabel: 'Sign out',
    });
    expect(unused!.signOutQuestion.message).toBe('This computer forgets the Jira sign-in.');
  });

  it('says the window’s repository is one of those that lose their tracker', () => {
    const [here] = signInRows(setup([jira]), 'game@acme@unity');
    expect(here!.signOutQuestion.message).toBe('This computer forgets the Jira sign-in, and this repository goes back to showing issues as plain text.');
    const shared = { ...setup([jira]), bindings: [...setup([jira]).bindings, { repository: 'tools@acme@unity', connectionId: 'j', projects: ['VCS'] }] };
    expect(signInRows(shared, 'game@acme@unity')[0]!.signOutQuestion.message).toBe('This computer forgets the Jira sign-in, and this repository and 1 other using it go back to showing issues as plain text.');
  });
});

describe('otherTokenPageOffered', () => {
  it('offers the other token page only where a tracker has two: Jira Data Center, its own and an app’s', () => {
    expect(otherTokenPageOffered('jiraDataCenter')).toBe(true);
    expect(otherTokenPageOffered('jiraCloud')).toBe(false);
    expect(otherTokenPageOffered('github')).toBe(false);
  });
});

describe('the sign-ins Connect offers first', () => {
  it('offers the sign-ins that work, never one that needs signing in again', () => {
    expect(usableSignIns(setup([jira, { ...jira, id: 'r', credential: 'refused' }])).map((row) => row.id)).toEqual(['j']);
    expect(usableSignIns(undefined)).toEqual([]);
  });

  it('marks the one the window’s repository uses, when it changes its tracker', () => {
    expect(usableSignIns(setup([jira]), 'game@acme@unity').map((row) => row.detail)).toEqual(['acme.atlassian.net · This repository']);
  });

  it('says which sign-in was picked until a link to another server is pasted', () => {
    const covered = { kind: 'useConnection' as const, connection: jira, words: '' };
    expect(pickedSignInShown('j', false, null)).toBe(true);
    expect(pickedSignInShown('j', true, covered)).toBe(true);
    expect(pickedSignInShown('j', true, { kind: 'signIn', methods: ['token'], trackerName: 'GitHub' })).toBe(false);
    expect(pickedSignInShown(null, false, null)).toBe(false);
  });

  it('connects through a sign-in already there when one was picked, or one covers the link', () => {
    expect(connectsWithSignIn('j', false, null)).toBe(true);
    expect(connectsWithSignIn(null, true, { kind: 'useConnection', connection: jira, words: '' })).toBe(true);
    expect(connectsWithSignIn('j', true, { kind: 'signIn', methods: ['token'], trackerName: 'GitHub' })).toBe(false);
    expect(connectsWithSignIn(null, false, null)).toBe(false);
  });
});

describe('repositoryTrackerView', () => {
  it('shows Connect once something was picked, the start while there is no tracker or it is being changed, else the tracker', () => {
    const start = { choice: 'jira' as const };
    const tracker = { id: 't' };
    expect(repositoryTrackerView({ start, connected: tracker, changing: false })).toEqual({ kind: 'connect', start });
    expect(repositoryTrackerView({ start: null, connected: null, changing: false })).toEqual({ kind: 'start', changingFrom: null });
    expect(repositoryTrackerView({ start: null, connected: tracker, changing: true })).toEqual({ kind: 'start', changingFrom: tracker });
    expect(repositoryTrackerView({ start: null, connected: tracker, changing: false })).toEqual({ kind: 'connected', connected: tracker });
  });
});

describe('connectStage', () => {
  it('asks for the link until one reads back, then signs in', () => {
    expect(connectStage(linkReadBack(''))).toBe('link');
    expect(connectStage(linkReadBack('https://example.com/x'))).toBe('link');
    expect(connectStage(linkReadBack('https://acme.atlassian.net/browse/VCS-1'))).toBe('signIn');
  });
});
