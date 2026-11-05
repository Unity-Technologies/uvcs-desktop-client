import type { IssueTrackerKind, IssueTrackerSetup, ProjectAccess, SignInFailure, SignInMethodKind, TrackerConnection } from '@shared/domain/issueTrackers';
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
  { tracker: 'GitHub', shape: 'github.com/owner/repo/issues/123' },
];

export const LINK_PLACEHOLDER = 'https://your-company.atlassian.net/browse/PROJ-123';

/** A tracker's kind in words, its server's kind told apart: "Jira Cloud", "GitHub", "GitHub Enterprise Server". */
export function trackerKindName(kind: IssueTrackerKind, server: string): string {
  if (kind === 'jiraCloud') return 'Jira Cloud';
  return isGitHubCloud(server) ? 'GitHub' : 'GitHub Enterprise Server';
}

/** A server by its host, as people say it: `acme.atlassian.net`. */
export function hostOf(server: string): string {
  return new URL(server).host;
}

/** What a pasted link reads back as, with nothing sent: "Jira Cloud · acme.atlassian.net · project VCS". */
export type LinkReadBack = { kind: 'read'; words: string; link: RecognizedLink } | { kind: 'problem'; words: string } | { kind: 'none' };

export function linkReadBack(text: string): LinkReadBack {
  if (!text.trim()) return { kind: 'none' };
  const reading = recognizeTrackerLink(text);
  if (isRecognizedLink(reading)) {
    const project = reading.kind === 'jiraCloud' ? `project ${reading.project}` : reading.project;
    return { kind: 'read', words: `${trackerKindName(reading.kind, reading.server)} · ${hostOf(reading.server)} · ${project}`, link: reading };
  }
  if ('notAnIssue' in reading) return { kind: 'problem', words: `That's a link to ${reading.notAnIssue}, not an issue. Open any issue and copy its address.` };
  if ('notALink' in reading) return { kind: 'problem', words: 'Paste the address of an issue, as your browser shows it.' };
  return { kind: 'problem', words: "That isn't a Jira or GitHub issue. Open an issue in your tracker and copy its address." };
}

/** What signing in to a pasted link's tracker takes: a connection already signed in, or the ways to sign in. */
export type SignInStep = { kind: 'useConnection'; connection: TrackerConnection; words: string } | { kind: 'signIn'; methods: SignInMethodKind[]; trackerName: string; needsEmail: boolean };

export function signInStepFor(link: RecognizedLink, setup: IssueTrackerSetup): SignInStep {
  const connection = coveringConnection(setup.connections, link.kind, link.server, link.project);
  if (connection && (connection.credential === 'kept' || connection.credential === 'session')) {
    return { kind: 'useConnection', connection, words: `${TRACKER_GRAMMARS[connection.kind].name} at ${hostOf(connection.server)} · signed in as ${connection.account.name}` };
  }
  return { kind: 'signIn', methods: signInMethodsFor(link.kind, link.server, setup.deviceFlowHosts), trackerName: TRACKER_GRAMMARS[link.kind].name, needsEmail: link.kind === 'jiraCloud' };
}

/** Jira Cloud's email, filled in with the `cm` user when that's an address (as on Unity Cloud), else the one kept. */
export function suggestedEmail(cmUser: string | undefined, kept: string | undefined): string {
  if (kept) return kept;
  return cmUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cmUser.trim()) ? cmUser.trim() : '';
}

/** Whether a token pasted in the field signs in at once: one of the tracker's known shapes (`ghp_`, `ATATT`). */
export function submitsOnPaste(kind: IssueTrackerKind, value: string): boolean {
  return TRACKER_GRAMMARS[kind].tokenShape(value.trim()) === 'known';
}

/** The proof a sign-in works (study's "Signed in" step): the project, its open issues and those assigned to the account. */
export function proofWords(link: Pick<RecognizedLink, 'kind'>, access: ProjectAccess): string {
  const project = link.kind === 'jiraCloud' ? `Project ${access.project}` : access.name;
  if (access.openIssues === undefined) return project;
  const assigned = access.assignedToYou === undefined ? '' : `, ${access.assignedToYou} assigned to you`;
  return `${project} · ${pluralize(access.openIssues, 'open issue')}${assigned}`;
}

/** The repository's tracker, as the section shows it once connected. */
export interface ConnectedTracker {
  connection: TrackerConnection;
  title: string;
  projects: string;
  account: string;
  /** Its credential stopped working: "Sign in again", with why. */
  signInAgain?: string;
  /** No keyring on this computer: the sign-in lasts until the app quits. */
  sessionOnly?: string;
}

export function connectedTrackerOf(setup: IssueTrackerSetup | undefined, repository: string | undefined): ConnectedTracker | null {
  if (!setup || !repository) return null;
  const binding = bindingOf(setup.bindings, repository);
  const connection = binding && setup.connections.find((kept) => kept.id === binding.connectionId);
  if (!binding || !connection) return null;
  const name = TRACKER_GRAMMARS[connection.kind].name;
  return {
    connection,
    title: `${name} at ${hostOf(connection.server)}`,
    projects: connection.kind === 'jiraCloud' ? binding.projects.map((project) => `Project ${project}`).join(', ') : binding.projects.join(', '),
    account: `Signed in as ${connection.account.name}`,
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
    case 'insecure':
      return { words: "This server doesn't use a secure connection (https), so your token would travel readable.", offersTokenPage: false };
    case 'tokenShape':
      return { words: `That doesn't look like a ${trackerName} token. Copy it again from ${trackerName}.`, offersTokenPage: true };
    case 'tokenRefused':
      return {
        words: context.email ? `${trackerName} didn't accept this token for ${context.email}. Check the email, or create a new token.` : `${trackerName} didn't accept this token. Create a new one.`,
        offersTokenPage: true,
      };
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
