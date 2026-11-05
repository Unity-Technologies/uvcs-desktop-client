import type { IssueTrackerKind, IssueTrackerSetup, SignInFailure, SignInMethodKind, SignInOutcome, TrackerConnection } from '@shared/domain/issueTrackers';
import { coveringConnection } from '@shared/issueTrackers/connections';
import { isGitHubCloud } from '@shared/issueTrackers/grammars/github';
import { bindingOf } from '@shared/issueTrackers/issueReferences';
import { signInMethodsFor } from '@shared/issueTrackers/signInMethods';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { isRecognizedLink, recognizeTrackerLink, TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { pluralize } from '../../../lib/text';

/** The shapes of an issue's link per tracker, under the empty field: what to paste, seen at once. */
export const LINK_EXAMPLES: readonly { tracker: string; shape: string }[] = [
  { tracker: 'Jira', shape: 'your-company.atlassian.net/browse/PROJ-123' },
  { tracker: 'Jira Data Center', shape: 'jira.your-company.com/browse/PROJ-123' },
  { tracker: 'GitHub', shape: 'github.com/owner/repo/issues/123' },
];

export const LINK_PLACEHOLDER = 'https://your-company.atlassian.net/browse/PROJ-123';

/** A tracker's kind in words, its server's kind told apart: "Jira Cloud", "GitHub", "GitHub Enterprise Server". */
export function trackerKindName(kind: IssueTrackerKind, server: string): string {
  if (kind === 'jiraCloud') return 'Jira Cloud';
  if (kind === 'jiraDataCenter') return 'Jira Data Center';
  return isGitHubCloud(server) ? 'GitHub' : 'GitHub Enterprise Server';
}

/**
 * Whether the token step offers "Other token page": only where a tracker makes tokens on two pages and main picks one
 * (Jira Data Center: its own, or the API Token Authentication app's, `TokenPages`).
 */
export function otherTokenPageOffered(kind: IssueTrackerKind): boolean {
  return kind === 'jiraDataCenter';
}

/** Jira, Cloud or Data Center: its projects named by key ("Project VCS"). */
function isJira(kind: IssueTrackerKind): boolean {
  return kind !== 'github';
}

/** A server by its host, as people say it: `acme.atlassian.net`. */
export function hostOf(server: string): string {
  return new URL(server).host;
}

/**
 * What a pasted link reads back as, with nothing sent: "Jira Cloud · acme.atlassian.net · project VCS", in words for
 * screen readers and in parts for the eye (the tracker's kind as a badge, the project bold).
 */
export type LinkReadBack = { kind: 'read'; words: string; parts: LinkParts; link: RecognizedLink } | { kind: 'problem'; words: string } | { kind: 'none' };

export interface LinkParts {
  kindName: string;
  host: string;
  /** "project", or none for a GitHub repository, which names itself. */
  projectNoun?: string;
  project: string;
}

export function linkReadBack(text: string): LinkReadBack {
  if (!text.trim()) return { kind: 'none' };
  const reading = recognizeTrackerLink(text);
  if (isRecognizedLink(reading)) {
    const parts: LinkParts = { kindName: trackerKindName(reading.kind, reading.server), host: hostOf(reading.server), ...(isJira(reading.kind) && { projectNoun: 'project' }), project: reading.project };
    const project = parts.projectNoun ? `${parts.projectNoun} ${parts.project}` : parts.project;
    return { kind: 'read', words: `${parts.kindName} · ${parts.host} · ${project}`, parts, link: reading };
  }
  if ('notAnIssue' in reading) return { kind: 'problem', words: `That's a link to ${reading.notAnIssue}, not an issue. Open any issue and copy its address.` };
  if ('notALink' in reading) return { kind: 'problem', words: 'Paste the address of an issue, as your browser shows it.' };
  return { kind: 'problem', words: "That isn't a Jira or GitHub issue. Open an issue in your tracker and copy its address." };
}

/** What signing in to a pasted link's tracker takes: a connection already signed in, or the ways to sign in. */
export type SignInStep = { kind: 'useConnection'; connection: TrackerConnection; words: string } | { kind: 'signIn'; methods: SignInMethodKind[]; trackerName: string };

export function signInStepFor(link: RecognizedLink, setup: IssueTrackerSetup): SignInStep {
  const connection = coveringConnection(setup.connections, link.kind, link.server, link.project);
  if (connection && (connection.credential === 'kept' || connection.credential === 'session')) {
    return { kind: 'useConnection', connection, words: `${TRACKER_GRAMMARS[connection.kind].name} at ${hostOf(connection.server)} · signed in as ${connection.account.name}` };
  }
  return { kind: 'signIn', methods: signInMethodsFor(link.kind, link.server, setup.deviceFlowHosts), trackerName: TRACKER_GRAMMARS[link.kind].name };
}

/** Jira Cloud's email, filled in with the `cm` user when that's an address (as on Unity Cloud), else the one kept. */
export function suggestedEmail(cmUser: string | undefined, kept: string | undefined): string {
  if (kept) return kept;
  return cmUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cmUser.trim()) ? cmUser.trim() : '';
}

/** The token step's words per tracker: the field's label, the email's for Jira Cloud, and what the token is for. */
export interface TokenStepWords {
  tokenLabel: string;
  /** Jira Cloud's token goes with the account's email. */
  emailLabel?: string;
  hint: string;
}

export function tokenStepWords(kind: IssueTrackerKind): TokenStepWords {
  switch (kind) {
    case 'jiraCloud':
      return { tokenLabel: 'Jira API token', emailLabel: 'Your Atlassian account email', hint: 'Made on your Atlassian account’s Security page. The app only reads issues with it.' };
    case 'jiraDataCenter':
      // Jira's own personal access token, or one an app such as API Token Authentication makes: "Jira token" names both.
      return { tokenLabel: 'Jira token', hint: 'The app only reads issues with it.' };
    case 'github':
      return { tokenLabel: 'GitHub token', hint: 'The app only reads issues with it.' };
  }
}

/** Whether the token step can sign in with `token`: one given, not while signing in, and Jira Cloud's email given. */
export function tokenStepReady(kind: IssueTrackerKind, email: string, token: string, busy: boolean): boolean {
  return !busy && token.trim() !== '' && (tokenStepWords(kind).emailLabel === undefined || email.trim() !== '');
}

/**
 * Whether the clipboard is emptied after a sign-in: only when the token was pasted and signed in. Emptied whatever it
 * holds by then, knowingly: checking that it still holds the token would mean reading it, which the app never does
 * (a read can bring up the system's paste prompt), and a moment after the paste it holds the token.
 */
export function clearsClipboardAfter(pasted: boolean, outcome: Pick<SignInOutcome, 'kind'>): boolean {
  return pasted && outcome.kind === 'signedIn';
}

/** Which way to sign in shows: the server's best, unless the user chose a token instead ("Use a token instead"). */
export function signInMethodShown(methods: readonly SignInMethodKind[], tokenChosen: boolean): 'deviceCode' | 'token' {
  return methods[0] === 'deviceCode' && !tokenChosen ? 'deviceCode' : 'token';
}

/** Whether "Add a project" can read its link: one that reads back as an issue. */
export function addProjectReady(link: string): boolean {
  return linkReadBack(link).kind === 'read';
}

/**
 * What "Sign in again" does after trying the kept credential once more (`retrySignIn`): a credential the tracker
 * refused needs a new one, by the server's methods (`signInMethodsFor`); out of reach or rate limited, the credential
 * stays and the section says why, to try again later.
 */
export type SignInAgainStep = { kind: 'askCredential'; methods: SignInMethodKind[] } | { kind: 'problem'; words: string };

export function signInAgainStep(connection: Pick<TrackerConnection, 'kind' | 'server'>, failure: SignInFailure, deviceFlowHosts: readonly string[]): SignInAgainStep {
  if (failure.reason === 'tokenRefused') return { kind: 'askCredential', methods: signInMethodsFor(connection.kind, connection.server, deviceFlowHosts) };
  return { kind: 'problem', words: connectFailureWords(failure, { trackerName: TRACKER_GRAMMARS[connection.kind].name, server: connection.server }).words };
}

/**
 * What "Sign in again" shows: before any try, why it's needed and "Sign in again"; after a try that couldn't reach the
 * tracker, why and "Try again"; once a new credential is needed, the way to sign in (`signInMethodShown`).
 */
export type SignInAgainView = { kind: 'retry'; words: string; button: string } | { kind: 'deviceCode' } | { kind: 'token' };

export function signInAgainView(step: SignInAgainStep | null, why: string, tokenChosen: boolean): SignInAgainView {
  if (!step) return { kind: 'retry', words: why, button: 'Sign in again' };
  if (step.kind === 'problem') return { kind: 'retry', words: step.words, button: 'Try again' };
  return { kind: signInMethodShown(step.methods, tokenChosen) };
}

/** Whether a token pasted in the field signs in at once: one of the tracker's known shapes (`ghp_`, `ATATT`). */
export function submitsOnPaste(kind: IssueTrackerKind, value: string): boolean {
  return TRACKER_GRAMMARS[kind].tokenShape(value.trim()) === 'known';
}

/** The repository's tracker, as the section shows it once connected. */
export interface ConnectedTracker {
  connection: TrackerConnection;
  /** The bound projects' keys, or GitHub's `owner/repo`. */
  projectKeys: string[];
  /** Its credential stopped working: "Sign in again", with why. */
  signInAgain?: string;
  /** No keyring on this computer: the sign-in lasts until the app quits. */
  sessionOnly?: string;
}

/** A connection in words, as the section names it: "Jira at acme.atlassian.net". */
export function connectionTitle(connection: Pick<TrackerConnection, 'kind' | 'server'>): string {
  return `${TRACKER_GRAMMARS[connection.kind].name} at ${hostOf(connection.server)}`;
}

/** The sign-ins this computer keeps, as a window with no repository lists them: each with how it stands. */
export function signInRows(setup: IssueTrackerSetup | undefined): { id: string; kind: IssueTrackerKind; title: string; account: string; status: { tone: 'positive' | 'caution'; label: string }; signOut: string }[] {
  return (setup?.connections ?? []).map((connection) => {
    const needsSignIn = connection.credential === 'refused' || connection.credential === 'missing';
    return {
      id: connection.id,
      kind: connection.kind,
      title: connectionTitle(connection),
      // The account alone: the pill beside it says whether it's signed in.
      account: connection.account.name,
      status: needsSignIn ? { tone: 'caution', label: 'Needs signing in' } : { tone: 'positive', label: 'Signed in' },
      signOut: `Sign out of ${hostOf(connection.server)}`,
    };
  });
}

export function connectedTrackerOf(setup: IssueTrackerSetup | undefined, repository: string | undefined): ConnectedTracker | null {
  if (!setup || !repository) return null;
  const binding = bindingOf(setup.bindings, repository);
  const connection = binding && setup.connections.find((kept) => kept.id === binding.connectionId);
  if (!binding || !connection) return null;
  const name = TRACKER_GRAMMARS[connection.kind].name;
  return {
    connection,
    projectKeys: binding.projects,
    ...(connection.credential === 'refused' && { signInAgain: `${name} stopped accepting this sign-in.` }),
    ...(connection.credential === 'missing' && { signInAgain: `This computer no longer has the ${name} sign-in.` }),
    ...(connection.credential === 'session' && { sessionOnly: 'Kept until you quit: this computer has no keyring.' }),
  };
}

/** A failure in plain words, and whether a new token would help (a link back to the token page). */
export interface FailureWords {
  words: string;
  offersTokenPage: boolean;
}

export function connectFailureWords(failure: SignInFailure, context: { trackerName: string; server?: string; email?: string }): FailureWords {
  const { trackerName } = context;
  const host = context.server ? hostOf(context.server) : trackerName;
  switch (failure.reason) {
    case 'notAnIssueLink':
      return { words: failure.what ? `That's a link to ${failure.what}, not an issue. Open any issue and copy its address.` : 'Paste the address of an issue.', offersTokenPage: false };
    case 'hostDeclined':
      return { words: `Not signed in: ${hostOf(failure.server)} wasn't allowed.`, offersTokenPage: false };
    case 'insecure':
      return { words: "This server doesn't use a secure connection (https), so your token would travel readable.", offersTokenPage: false };
    case 'tokenShape':
      return { words: `That doesn't look like a ${trackerName} token. Copy it again from ${trackerName}.`, offersTokenPage: true };
    case 'tokenRefused':
      return {
        words: context.email ? `${trackerName} didn't accept this token for ${context.email}. Check the email, or create a new token.` : `${trackerName} didn't accept this token. Create a new one.`,
        offersTokenPage: true,
      };
    case 'sentToLogin':
      return { words: `${trackerName} sent this sign-in to its login page at ${hostOf(failure.server)}. Check the token, or create a new one.`, offersTokenPage: true };
    case 'emailNeeded':
      return { words: `${trackerName} needs the email you sign in with, along with the token.`, offersTokenPage: false };
    case 'projectUnreadable':
      return { words: `You're signed in, but ${failure.project} can't be read with this sign-in. Check that the token can read it.`, offersTokenPage: true };
    case 'notGitHubEnterprise':
      return { words: "This doesn't look like GitHub Enterprise Server.", offersTokenPage: false };
    case 'unreachable':
      return { words: `${trackerName} couldn't be reached at ${host}.`, offersTokenPage: false };
    case 'rateLimited':
      return { words: `${trackerName} asked to wait a moment. Try again in a minute.`, offersTokenPage: false };
    case 'denied':
      return { words: `The sign-in was declined on ${trackerName}.`, offersTokenPage: false };
    case 'expired':
      return { words: 'The code expired before it was approved. Start again.', offersTokenPage: false };
    case 'canceled':
      return { words: 'Sign-in canceled.', offersTokenPage: false };
    case 'unexpected':
      return { words: `Couldn't sign in to ${trackerName}: ${failure.message}`, offersTokenPage: false };
  }
}

/** A link the branch comments already read point to, offered (never filled in) when the field is empty. */
export interface SuggestedLink {
  link: string;
  words: string;
  trackerName: string;
  /** "Seen in 37 branch comments". */
  seen: string;
}

const ADDRESS = /https?:\/\/[^\s<>()[\]"'`]+/g;

/**
 * The tracker the branch comments link to most (`recognizeTrackerLink` on every address in them), from the lists the
 * window already read: no command. None when they link to none.
 */
export function suggestedTrackerLink(comments: readonly string[]): SuggestedLink | null {
  const seen = new Map<string, { link: string; reading: RecognizedLink; count: number }>();
  for (const comment of comments) {
    const tracked = new Set<string>();
    for (const [address] of comment.matchAll(ADDRESS)) {
      const reading = recognizeTrackerLink(address.replace(/[.,;:!?]+$/, ''));
      if (!isRecognizedLink(reading) || reading.shows !== 'issuePage') continue;
      const id = `${reading.kind} ${reading.server} ${reading.project}`;
      if (tracked.has(id)) continue;
      tracked.add(id);
      const entry = seen.get(id) ?? { link: address, reading, count: 0 };
      entry.count++;
      seen.set(id, entry);
    }
  }
  const best = [...seen.values()].sort((a, b) => b.count - a.count)[0];
  if (!best) return null;
  const read = linkReadBack(best.link);
  return {
    link: best.link,
    words: read.kind === 'read' ? read.words : best.link,
    trackerName: TRACKER_GRAMMARS[best.reading.kind].name,
    seen: `Seen in ${pluralize(best.count, 'branch comment')}`,
  };
}

/** The device flow's step, in words: where to enter the code, which was copied, and what the app waits for. */
export function deviceCodeWords(code: { verificationUri: string }, trackerName: string): { instruction: string; waiting: string } {
  const page = code.verificationUri.replace(/^https?:\/\//, '');
  return { instruction: `Paste this code at ${page}, opened in your browser. It's copied.`, waiting: `Waiting for ${trackerName}…` };
}
