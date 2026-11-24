import { describe, expect, it } from 'vitest';
import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import { signInWords } from './signInWords';

const problem = (kind: SignInProblemKind, server = 'build.acme.com:8087'): SignInProblem => ({ kind, server, details: { commandLine: `cm checkconnection ${server}`, output: '' } });

describe('signInWords', () => {
  it.each([
    ['signInRequired', "You're not signed in to build.acme.com:8087"],
    ['sessionEnded', 'Your session for build.acme.com:8087 ended'],
    ['credentialsRefused', "build.acme.com:8087 didn't accept your user or password"],
    ['noLicense', 'Your account has no license on build.acme.com:8087'],
    ['locked', 'build.acme.com:8087 locked this account for now'],
  ] as const)('names the server in what a %s problem says', (kind, title) => {
    expect(signInWords(problem(kind)).title).toBe(title);
  });

  it('names the server as the rest of the app does: an organization by its name, the local server as the one on this computer', () => {
    // Never "this computer" alone: it would read as the computer's own session.
    expect(signInWords(problem('sessionEnded', 'local')).title).toBe('Your session for the server on this computer ended');
    expect(signInWords(problem('locked', 'local')).title).toBe('The server on this computer locked this account for now');
    expect(signInWords(problem('sessionEnded', 'AcmeStudio@unity')).title).toBe('Your session for AcmeStudio ended');
    expect(signInWords(problem('credentialsRefused', 'acme@cloud')).title).toBe("acme didn't accept your user or password");
  });

  it('offers the app that signs in only where signing in again is the way forward', () => {
    expect(signInWords(problem('sessionEnded'))).toMatchObject({ offersSignInApp: true, explanation: expect.stringContaining('Sign in there again') });
    expect(signInWords(problem('signInRequired')).offersSignInApp).toBe(true);
    expect(signInWords(problem('credentialsRefused')).offersSignInApp).toBe(true);
    expect(signInWords(problem('noLicense'))).toMatchObject({ offersSignInApp: false, explanation: 'Ask an administrator of the server for one, then check again.' });
    expect(signInWords(problem('locked'))).toMatchObject({ offersSignInApp: false, explanation: 'Try again later.' });
  });
});
