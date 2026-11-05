/**
 * Issue trackers (docs/features/issue-trackers.md): a sign-in to a tracker (`TrackerConnection`), which repositories
 * use it (`RepositoryTrackerBinding`), and the issues read from it. No secret is ever part of these: the credential
 * stays in the main process (`TrackerSecrets`).
 */

/** The trackers the app reaches. GitHub.com, its data residency hosts and Enterprise Server are one API, one kind. */
export type IssueTrackerKind = 'jiraCloud' | 'github';

/**
 * How a sign-in is made, preferred first in `signInMethodsFor`: a code the user approves in the browser
 * (OAuth's device flow, RFC 8628), a sign-in page in the browser (OAuth with a redirect), or a token the user creates.
 */
export type SignInMethodKind = 'deviceCode' | 'browser' | 'token';

/**
 * Whether a connection's credential can be used: `kept` encrypted on disk, `session` in memory until the app quits (no
 * keyring), `missing` (none to use: a session's after a restart, or the keychain refused to decrypt it), `refused` (the
 * tracker answered 401 to it this session).
 */
export type CredentialState = 'kept' | 'session' | 'missing' | 'refused';

/** Someone on a tracker: the signed-in account, an issue's assignee. */
export interface TrackerAccount {
  /** The tracker's own id for them (Jira's account id, GitHub's login). */
  id: string;
  /** Their name as the tracker shows it, or their login when they have none. */
  name: string;
  /** Jira Cloud's sign-in email, kept to sign in again; no secret. */
  email?: string;
}

/** A sign-in to a tracker, which every repository it covers shares. */
export interface TrackerConnection {
  id: string;
  kind: IssueTrackerKind;
  /** Its web address, as issues' links have it: `https://acme.atlassian.net`, `https://github.com`. */
  server: string;
  /**
   * What one sign-in covers beyond its server: on GitHub, the owner a fine-grained token was made for (lower case), or
   * `*` for a token of every owner (a classic token, the device flow's). None for a Jira site.
   */
  scope?: string;
  account: TrackerAccount;
  signInMethod: SignInMethodKind;
  /** What it was asked for: reading. */
  access: 'read';
  credential: CredentialState;
  /** Jira Cloud: where its API answered this token, the site or Atlassian's gateway (a scoped token). */
  apiBase?: string;
}

/** A repository that uses a tracker: its connection and the projects its comments name. */
export interface RepositoryTrackerBinding {
  /** The repository's spec as `cm` names it: `game@acme@unity`. */
  repository: string;
  connectionId: string;
  /** Jira project keys (`VCS`), GitHub repositories (`acme/game`, lower case). */
  projects: string[];
}

/** What the windows know of the trackers: connections without their secrets, and bindings. */
export interface IssueTrackerSetup {
  connections: TrackerConnection[];
  bindings: RepositoryTrackerBinding[];
  /** Credentials can't be kept on this computer (Linux without a keyring): they last until the app quits. */
  sessionOnly: boolean;
  /** The hosts GitHub's device flow can sign in to (`signInMethodsFor`): those an app is registered on. */
  deviceFlowHosts: string[];
}

/** The four states every tracker's statuses fall in, so any of them is colored alike. */
export type IssueStatusCategory = 'todo' | 'inProgress' | 'done' | 'canceled';

export interface Issue {
  /** Canonical (`issueKeyOf`): `VCS-12`, `acme/game#12`. */
  key: string;
  title: string;
  /** The tracker's own words: "In Progress", "Open", "Merged". */
  status: string;
  statusCategory: IssueStatusCategory;
  /** Jira's issue type ("Bug"), GitHub's "Issue" or "Pull request". */
  type: string;
  assignee: TrackerAccount | null;
  url: string;
}

/** Why a tracker couldn't answer. */
export type TrackerErrorReason = 'unreachable' | 'signInRefused' | 'noAccess' | 'rateLimited' | 'unexpected';

/** One key of a batch read: found, missing (no such issue), out of the token's reach, or not read this time. */
export type IssueRead =
  | { key: string; kind: 'found'; issue: Issue }
  | { key: string; kind: 'missing' }
  | { key: string; kind: 'noAccess' }
  | { key: string; kind: 'unreadable'; reason: TrackerErrorReason; retryAt?: number };

/** Proof that a project can be read: its name and its counts. */
export interface ProjectAccess {
  project: string;
  name: string;
  openIssues?: number;
  assignedToYou?: number;
}

/** Why a sign-in or a project didn't work, for the words Connect shows (`connectFailureWords`). */
export type SignInFailure =
  | { reason: 'notAnIssueLink'; what?: string }
  | { reason: 'insecure' }
  /** The user didn't allow a sign-in to a host no tracker is known by (`needsHostConsent`). */
  | { reason: 'hostDeclined'; server: string }
  | { reason: 'tokenShape' }
  | { reason: 'tokenRefused' }
  | { reason: 'emailNeeded' }
  | { reason: 'projectUnreadable'; project: string }
  | { reason: 'notGitHubEnterprise'; server: string }
  | { reason: 'unreachable'; server: string }
  | { reason: 'rateLimited' }
  | { reason: 'denied' }
  | { reason: 'expired' }
  | { reason: 'canceled' }
  | { reason: 'unexpected'; message: string };

/** A sign-in that worked, with the proof of its project (none when signing in again, which proves only the account). */
export type SignInOutcome = { kind: 'signedIn'; connection: TrackerConnection; access?: ProjectAccess } | { kind: 'failed'; failure: SignInFailure };


/** A device flow under way: the code the user enters at `verificationUri`. */
export interface DeviceSignIn {
  flowId: string;
  userCode: string;
  verificationUri: string;
  /** When the code stops working (ms since the epoch). */
  expiresAt: number;
}
