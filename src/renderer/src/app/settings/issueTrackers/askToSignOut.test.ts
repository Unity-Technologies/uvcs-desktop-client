import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { answerConfirms, askedDialogs } from '../../../testing/fakeDialogs';
import { askToSignOut } from './askToSignOut';
import type { SignInRow } from './connectFlow';

vi.mock('../../../ui/dialog/confirm', () => import('../../../testing/fakeDialogs'));

const row: SignInRow = {
  id: 'c1',
  kind: 'jiraCloud',
  title: 'Jira at acme.atlassian.net',
  account: 'Ana Díaz',
  host: 'acme.atlassian.net',
  detail: 'acme.atlassian.net',
  status: { tone: 'positive', label: 'Signed in' },
  needsAttention: false,
  usedHere: false,
  signOut: 'Sign out of acme.atlassian.net',
  signOutQuestion: { title: 'Sign out of Jira at acme.atlassian.net?', message: 'This computer forgets the Jira sign-in.', confirmLabel: 'Sign out' },
};

describe('askToSignOut', () => {
  it('signs out of the sign-in once the user says so', async () => {
    fakeApi.answer('issueTrackers.signOut', () => undefined);
    answerConfirms(true);

    await askToSignOut(row);

    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Sign out of Jira at acme.atlassian.net?']);
    expect(fakeApi.argsOf('issueTrackers.signOut')).toEqual([['c1']]);
  });

  it('keeps the sign-in when the user says no', async () => {
    answerConfirms(false);

    await askToSignOut(row);

    expect(fakeApi.methods()).toEqual([]);
  });
});
