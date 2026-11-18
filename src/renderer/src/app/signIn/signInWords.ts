import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';

export interface SignInWords {
  title: string;
  /** What to do, on this app's terms today: the sign-in is made in the Unity Version Control app. */
  explanation: string;
  /** Whether signing in again is the way forward, so the screen offers the app that signs in. */
  offersSignInApp: boolean;
}

const SIGN_IN_APP = 'This app uses the sign-in of the Unity Version Control app.';

const WORDS: Record<SignInProblemKind, (server: string) => SignInWords> = {
  signInRequired: (server) => ({ title: `You're not signed in to ${server}`, explanation: `${SIGN_IN_APP} Sign in there, then check again.`, offersSignInApp: true }),
  sessionEnded: (server) => ({ title: `Your session for ${server} ended`, explanation: `${SIGN_IN_APP} Sign in there again, then check again.`, offersSignInApp: true }),
  credentialsRefused: (server) => ({
    title: `${server} didn't accept your user or password`,
    explanation: `${SIGN_IN_APP} Sign in there again, then check again.`,
    offersSignInApp: true,
  }),
  noLicense: (server) => ({ title: `Your account has no license on ${server}`, explanation: 'Ask an administrator of the server for one, then check again.', offersSignInApp: false }),
  locked: (server) => ({ title: `${server} locked this account for now`, explanation: 'Try again later.', offersSignInApp: false }),
};

/** What the sign-in screen says of a server that needs a sign-in (`SignInScreen`), naming the server. */
export function signInWords({ kind, server }: SignInProblem): SignInWords {
  return WORDS[kind](server);
}
