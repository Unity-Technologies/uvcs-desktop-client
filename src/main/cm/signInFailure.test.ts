import { describe, expect, it } from 'vitest';
import { signInFailureOf } from './signInFailure';

describe('signInFailureOf', () => {
  it.each([
    ['Enter credentials to connect to server [build.acme.com:8087]', 'signInRequired'],
    ['Select the system you want to use to sign in to: acme@cloud      ', 'signInRequired'],
    ['Select your system [0-1] ', 'signInRequired'],
    ['Open the following URL in your browser:', 'signInRequired'],
    ['User: ', 'signInRequired'],
    ['Password: ', 'signInRequired'],
    ['Error: The auth token expired. User: dev@acme.com.', 'sessionEnded'],
    ["The access token 'ci-token' expired.", 'sessionEnded'],
    ['Error: Invalid password. Review your user/password configuration.', 'credentialsRefused'],
    ["Unknown user: 'Dev'. Please check your current credentials. Remember that user names are case-sensitive!", 'credentialsRefused'],
    ['Invalid user credentials.', 'credentialsRefused'],
    ['Invalid credentials, username or password are not valid.', 'credentialsRefused'],
    ['Active Directory or LDAP: Invalid credentials username, password or domain are not valid. Server error: 49', 'credentialsRefused'],
    ['Username or password are not valid.', 'credentialsRefused'],
    [
      'The user dev@acme.com appears as an inactive user because his/her license has been deactivated. Please activate it and then try again.',
      'noLicense',
    ],
    ['Error: The maximum number of licensed users has been exceeded.', 'noLicense'],
    ["The account for 'dev' is currently locked. Please try again later.", 'locked'],
    ['Too many failed authentication attempts. Please try again later.', 'locked'],
  ] as const)('reads "%s" as cm prints it', (output, kind) => {
    expect(signInFailureOf(output)).toBe(kind);
  });

  it('finds the sentence among other lines, with Windows line ends', () => {
    const output = 'Please wait ...\r\nError: The auth token expired. User: dev@acme.com.\r\n   at Codice.Client.Run()\r\n';

    expect(signInFailureOf(output)).toBe('sessionEnded');
  });

  it('says nothing of a failure that is no sign-in problem', () => {
    expect(signInFailureOf("Error: Can't resolve DNS entry for nowhere.invalid")).toBeNull();
    expect(signInFailureOf('The branch br:/main/task does not exist.')).toBeNull();
    expect(signInFailureOf('')).toBeNull();
  });

  it('never takes a file, a comment or a name holding sign-in words for a sign-in problem', () => {
    // An update's progress names the files it downloads; a failed check-in can quote its comment.
    expect(signInFailureOf('Downloading /config/credentials.txt\nError: The item is locked')).toBeNull();
    expect(signInFailureOf('Comment: reset the password when Invalid user credentials. shows\nError: Merge needed')).toBeNull();
    expect(signInFailureOf('/docs/Password: how to reset it.md')).toBeNull();
    expect(signInFailureOf('The user token expired yesterday')).toBeNull();
  });
});
