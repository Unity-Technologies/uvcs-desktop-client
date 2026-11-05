import { describe, expect, it } from 'vitest';
import type { TrackerConnection } from '@shared/domain/issueTrackers';
import { accountLines, connectSteps, disconnectQuestion, projectRows, projectsExplained, tokenStepLead, trackerHeader, trackerStatus, unreachableWords } from './trackerCardContent';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraDataCenter', server: 'https://jira.unity3d.com', account: { id: 'JIRAUSER10100', name: 'Daniel Peñalba', email: 'daniel@unity3d.com' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const github: TrackerConnection = { ...jira, id: 'c2', kind: 'github', server: 'https://github.com', scope: '*', account: { id: 'danipen', name: 'Daniel Peñalba' } };

describe('trackerStatus', () => {
  it('is connected, calm, while the sign-in works', () => {
    expect(trackerStatus(jira, undefined)).toEqual({ tone: 'positive', label: 'Connected' });
    expect(trackerStatus({ ...jira, credential: 'session' }, { kind: 'read', projects: [] })).toEqual({ tone: 'positive', label: 'Connected' });
  });

  it('needs signing in when the credential was refused or is gone, or the projects’ read was refused', () => {
    expect(trackerStatus({ ...jira, credential: 'refused' }, undefined)).toEqual({ tone: 'caution', label: 'Needs sign-in' });
    expect(trackerStatus({ ...jira, credential: 'missing' }, undefined)).toMatchObject({ tone: 'caution' });
    expect(trackerStatus(jira, { kind: 'failed', reason: 'signInRefused' })).toMatchObject({ tone: 'caution' });
  });

  it('says the tracker can’t be reached when no project answered, where, and what that means', () => {
    expect(trackerStatus(jira, { kind: 'failed', reason: 'unreachable' })).toEqual({ tone: 'danger', label: "Can't reach Jira" });
    expect(unreachableWords(jira)).toEqual({ title: "Can't reach Jira at jira.unity3d.com", detail: 'Issues show as plain links until it answers.' });
  });
});

describe('trackerHeader and accountLines', () => {
  it('names the tracker, its kind and its host', () => {
    expect(trackerHeader(jira)).toEqual({ name: 'Jira', kindName: 'Jira Data Center', host: 'jira.unity3d.com' });
    expect(trackerHeader(github)).toEqual({ name: 'GitHub', kindName: 'GitHub', host: 'github.com' });
  });

  it('shows the email under the name, or a login that says more, never an opaque id', () => {
    expect(accountLines(jira.account)).toEqual({ name: 'Daniel Peñalba', detail: 'daniel@unity3d.com' });
    expect(accountLines(github.account)).toEqual({ name: 'Daniel Peñalba', detail: 'danipen' });
    expect(accountLines({ id: '5b10ac8d82e05b22cc7d4ef5', name: 'Ana' })).toEqual({ name: 'Ana' });
    expect(accountLines({ id: 'ana', name: 'ana' })).toEqual({ name: 'ana' });
  });
});

describe('projectRows', () => {
  it('shows each project’s key, its name and counts once read, and offers removing one only while another stays', () => {
    const answer = { kind: 'read' as const, projects: [{ project: 'VCS', access: { project: 'VCS', name: 'Version Control', openIssues: 214, assignedToYou: 6 } }, { project: 'OPS' }] };
    expect(projectRows(['VCS', 'OPS'], answer)).toEqual([
      { project: 'VCS', label: 'VCS', name: 'Version Control', counts: '214 open · 6 assigned to you', removeLabel: 'Remove VCS' },
      { project: 'OPS', label: 'OPS', removeLabel: 'Remove OPS' },
    ]);
    expect(projectRows(['VCS'], undefined)).toEqual([{ project: 'VCS', label: 'VCS' }]);
  });

  it('leaves out a name that only repeats the key, and counts the tracker didn’t give', () => {
    const answer = { kind: 'read' as const, projects: [{ project: 'acme/game', access: { project: 'acme/game', name: 'Acme/Game', openIssues: 42 } }] };
    expect(projectRows(['acme/game'], answer)).toEqual([{ project: 'acme/game', label: 'acme/game', counts: '42 open' }]);
  });
});

describe('projectsExplained', () => {
  it('says what the projects are for, with a reference as it would be written', () => {
    expect(projectsExplained('jiraCloud', ['VCS', 'OPS'])).toBe("Keys like VCS-123 in this repository's comments show as chips with the issue's title and status.");
    expect(projectsExplained('github', ['acme/game'])).toBe("#123 and links to its issues in this repository's comments show as chips with the issue's title and status.");
    expect(projectsExplained('github', ['acme/game', 'acme/tools'])).toBe("acme/game#123 and links to their issues in this repository's comments show as chips with the issue's title and status.");
  });
});

describe('disconnectQuestion', () => {
  it('says what Disconnect changes, and that the sign-in stays', () => {
    expect(disconnectQuestion('Jira')).toEqual({
      title: 'Disconnect Jira?',
      message: "Issues in this repository's comments go back to plain text. Your Jira sign-in stays for other repositories.",
      confirmLabel: 'Disconnect',
    });
  });
});

describe('connectSteps and tokenStepLead', () => {
  it('walks a link and signing in, after the tracker picked', () => {
    expect(connectSteps('link', 'Jira')).toEqual([
      { label: 'Jira', state: 'done' },
      { label: 'Link', state: 'current' },
      { label: 'Sign in', state: 'next' },
    ]);
    expect(connectSteps('signIn', 'GitHub').map((step) => step.state)).toEqual(['done', 'done', 'current']);
    // With a sign-in already there, the last step only connects.
    expect(connectSteps('signIn', 'Jira', { signedIn: true }).map((step) => step.label)).toEqual(['Jira', 'Link', 'Connect']);
  });

  it('leads with Create a token until a token is pasted, then with Sign in', () => {
    expect(tokenStepLead('')).toBe('createToken');
    expect(tokenStepLead('  ')).toBe('createToken');
    expect(tokenStepLead('abc')).toBe('signIn');
  });
});
