import { describe, expect, it } from 'vitest';
import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import { signInWords } from './signInWords';

const problem = (kind: SignInProblemKind): SignInProblem => ({ kind, server: 'acme@cloud', details: { commandLine: 'cm checkconnection acme@cloud', output: '' } });

describe('signInWords', () => {
  it.each([
    ['signInRequired', "You're not signed in to acme@cloud"],
    ['sessionEnded', 'Your session for acme@cloud ended'],
    ['credentialsRefused', "acme@cloud didn't accept your user or password"],
    ['noLicense', 'Your account has no license on acme@cloud'],
    ['locked', 'acme@cloud locked this account for now'],
  ] as const)('names the server in what a %s problem says', (kind, title) => {
    expect(signInWords(problem(kind)).title).toBe(title);
  });

  it('offers the app that signs in only where signing in again is the way forward', () => {
    expect(signInWords(problem('sessionEnded'))).toMatchObject({ offersSignInApp: true, explanation: expect.stringContaining('Sign in there again') });
    expect(signInWords(problem('signInRequired')).offersSignInApp).toBe(true);
    expect(signInWords(problem('credentialsRefused')).offersSignInApp).toBe(true);
    expect(signInWords(problem('noLicense'))).toMatchObject({ offersSignInApp: false, explanation: 'Ask an administrator of the server for one, then check again.' });
    expect(signInWords(problem('locked'))).toMatchObject({ offersSignInApp: false, explanation: 'Try again later.' });
  });
});
