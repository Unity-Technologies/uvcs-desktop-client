import type { BoundProjectsAnswer, DeviceSignIn, IssueRead, IssueSearch, IssueSearchAnswer, IssueTrackerSetup, SignInFailure, SignInOutcome } from '../domain/issueTrackers';

/** A sign-in for a repository, from a link to one of its tracker's issues: main reads the link itself. */
export interface RepositorySignIn {
  /** The repository's spec, as `cm` names it. */
  repository: string;
  /** A link to any issue of the tracker: it names the server and the project. */
  link: string;
  /** Jira Cloud's account email, which its token goes with. */
  email?: string;
}

/** Whose token page: a link's tracker, or a connection's (signing in again). */
export type TokenPageTarget = { link: string } | { connectionId: string };

/** The page a tracker usually makes tokens on, or its other one (Jira Data Center has two: `TokenPages`). */
export type TokenPageChoice = 'usual' | 'other';

/**
 * Issue trackers (docs/features/issue-trackers.md). The trackers are reached from main only; no credential ever comes
 * back to a window, and a token goes to main once, on sign-in.
 */
export interface IssueTrackersApi {
  /** The connections, without secrets, and the bindings. */
  setup(): Promise<IssueTrackerSetup>;

  /** Signs in with a token and binds the repository to the link's project, proving it. */
  signInWithToken(request: RepositorySignIn & { token: string }): Promise<SignInOutcome>;
  /** A connection whose credential stopped working, with a new token. */
  signInAgain(request: { connectionId: string; email?: string; token: string }): Promise<SignInOutcome>;
  /** Tries a connection's kept credential once more (`whoAmI`), before asking for a new one. */
  retrySignIn(connectionId: string): Promise<SignInOutcome>;
  /** Opens the tracker's token page in the browser, filled in where the tracker allows; or its other one. */
  openTokenPage(target: TokenPageTarget, choice?: TokenPageChoice): Promise<void>;

  /**
   * Starts GitHub's device flow: the code the user enters on the page it names. For a repository by a link, or for a
   * connection signing in again (its bindings kept).
   */
  startDeviceSignIn(request: RepositorySignIn | { connectionId: string }): Promise<DeviceSignIn | { failure: SignInFailure }>;
  /** Waits for the user to approve the code, then signs in and binds as a token would. */
  finishDeviceSignIn(flowId: string): Promise<SignInOutcome>;
  cancelDeviceSignIn(flowId: string): Promise<void>;

  /** Binds the repository to a connection already signed in, proving the link's project. */
  useConnection(request: RepositorySignIn & { connectionId: string }): Promise<SignInOutcome>;
  /** Adds the link's project to the repository's binding. */
  addProject(request: RepositorySignIn): Promise<SignInOutcome>;
  /** Takes a project off the repository's binding; its last one stays (Disconnect removes the binding). */
  removeProject(repository: string, project: string): Promise<void>;
  /** The repository's bound projects with their names and counts, as Settings shows them: one proof per project. */
  readProjects(repository: string): Promise<BoundProjectsAnswer>;
  /** The repository stops using its tracker; the connection stays for others. */
  disconnect(repository: string): Promise<void>;
  /** Removes a connection, its credential and its bindings. */
  signOut(connectionId: string): Promise<void>;

  /** The issues named, read in as few requests as the tracker allows (one per 100 keys). */
  readIssues(connectionId: string, keys: string[]): Promise<IssueRead[]>;
  /**
   * The repository's issues a `#` search finds, of its connection (`IssueSearch`), in one request. A window's newer
   * search for the repository replaces its running one, which answers `superseded`.
   */
  searchIssues(repository: string, search: IssueSearch): Promise<IssueSearchAnswer>;
}
