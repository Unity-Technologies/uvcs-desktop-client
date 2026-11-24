import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import { describeServer } from '../../lib/servers';

export interface SignInWords {
  title: string;
  /** What to do, on this app's terms today: the sign-in is made in the Unity Version Control app. */
  explanation: string;
  /** Whether signing in again is the way forward, so the screen offers the app that signs in. */
  offersSignInApp: boolean;
}

const SIGN_IN_APP = 'This app uses the sign-in of the Unity Version Control app.';

/** How a sentence names the server: inside it, and at its start (`serverInSentence`). */
export interface ServerNames {
  inside: string;
  first: string;
}

/** The words for each kind, given the server as a sentence names it. */
const WORDS: Record<SignInProblemKind, (server: ServerNames) => SignInWords> = {
  signInRequired: (server) => ({ title: `You're not signed in to ${server.inside}`, explanation: `${SIGN_IN_APP} Sign in there, then check again.`, offersSignInApp: true }),
  sessionEnded: (server) => ({ title: `Your session for ${server.inside} ended`, explanation: `${SIGN_IN_APP} Sign in there again, then check again.`, offersSignInApp: true }),
  credentialsRefused: (server) => ({
    title: `${server.first} didn't accept your user or password`,
    explanation: `${SIGN_IN_APP} Sign in there again, then check again.`,
    offersSignInApp: true,
  }),
  noLicense: (server) => ({ title: `Your account has no license on ${server.inside}`, explanation: 'Ask an administrator of the server for one, then check again.', offersSignInApp: false }),
  locked: (server) => ({ title: `${server.first} locked this account for now`, explanation: 'Try again later.', offersSignInApp: false }),
};

/** What the sign-in screen says of a server that needs a sign-in (`SignInScreen`), naming the server as the app does. */
export function signInWords({ kind, server }: SignInProblem): SignInWords {
  return WORDS[kind](serverInSentence(server));
}

/**
 * The server as the rest of the app names it (`describeServer`: an organization by its name, `local`, This computer in
 * lists, as the server on this computer, never the computer alone, whose own session it would read as), inside a
 * sentence and at its start: a server's own name keeps its case.
 */
export function serverInSentence(server: string): ServerNames {
  if (server === 'local') return { inside: 'the server on this computer', first: 'The server on this computer' };
  const { label } = describeServer(server);
  return { inside: label, first: label };
}
