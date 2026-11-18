import type { SignInProblemKind } from '@shared/domain/signIn';

/**
 * `cm`'s English sentences that say it can't work with a server until the user signs in (cm 11.0.16), each matched
 * whole on a line of its own, after `Error: ` or not. `{0}` in `cm`'s text is a name: `[^\n]+?` here.
 *
 * Whole sentences, never loose words: an update's progress names files (`credentials.txt`) and a failed check-in can
 * quote its comment ("reset the password"), and a secure connection that fails says "Authentication failed".
 * `cm checkconnection` adds only the prompts it is stopped at (`classifyConnectionCheck`).
 */
const SENTENCES: readonly (readonly [SignInProblemKind, RegExp])[] = [
  // `cm` asks on its console: it has no sign-in for that server. A stopped prompt pads its line with spaces.
  ['signInRequired', /^Enter credentials to connect to server \[[^\n]*\]$/],
  ['signInRequired', /^Select the system you want to use to sign in to: [^\n]+$/],
  ['signInRequired', /^Select your system \[\d+-\d+\]:?$/],
  ['signInRequired', /^Open the following URL in your browser:$/],
  ['signInRequired', /^(?:User|Password):$/],
  ['sessionEnded', /^The auth token expired\. User: [^\n]*\.$/],
  ['sessionEnded', /^The access token '[^\n]+?' expired\.$/],
  ['credentialsRefused', /^Invalid password\. Review your user\/password configuration\.$/],
  ['credentialsRefused', /^Unknown user: '[^\n]+?'\. Please check your current credentials\. Remember that user names are case-sensitive!$/],
  ['credentialsRefused', /^Invalid user credentials\.$/],
  ['credentialsRefused', /^Invalid credentials, username or password are not valid\.$/],
  ['credentialsRefused', /^Active Directory or LDAP: Invalid credentials username, password or domain are not valid\. Server error: [^\n]*$/],
  ['credentialsRefused', /^Username or password are not valid\.$/],
  ['noLicense', /^The user [^\n]+? appears as an inactive user because his\/her license has been deactivated\. Please activate it and then try again\.$/],
  ['noLicense', /^The maximum number of licensed users has been exceeded\.$/],
  ['locked', /^The account for '[^\n]+?' is currently locked\. Please try again later\.$/],
  ['locked', /^Too many failed authentication attempts\. Please try again later\.$/],
];

const ERROR_PREFIX = /^Error:\s*/;

/**
 * What a failed command's output says about signing in: the kind of sign-in problem, or null when it says nothing of
 * it (most failures). The only place that reads `cm`'s words about signing in.
 */
export function signInFailureOf(output: string): SignInProblemKind | null {
  for (const line of output.split(/\r?\n|\r/)) {
    const sentence = line.trim().replace(ERROR_PREFIX, '');
    const found = SENTENCES.find(([, pattern]) => pattern.test(sentence));
    if (found) return found[0];
  }
  return null;
}
