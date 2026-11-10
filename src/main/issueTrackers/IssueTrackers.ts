import type { LinkSignIn, RepositorySignIn, TokenPageChoice, TokenPageTarget } from '@shared/api/issueTrackers';
import type { BoundProject, BoundProjectsAnswer, DeviceSignIn, IssueRead, IssueSearch, IssueSearchAnswer, IssueTrackerKind, IssueTrackerSetup, TrackerErrorReason, SignInFailure, SignInMethodKind, SignInOutcome, TrackerConnection } from '@shared/domain/issueTrackers';
import { coveringConnection, needsHostConsent, ownerOf } from '@shared/issueTrackers/connections';
import { sameRepository } from '@shared/issueTrackers/issueReferences';
import { deviceFlowHostsOf, type GitHubApp } from '@shared/issueTrackers/signInMethods';
import type { RecognizedLink } from '@shared/issueTrackers/trackerGrammar';
import { isRecognizedLink, recognizeTrackerLink, TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import type { IssueTrackerStore, StoredConnection } from './IssueTrackerStore';
import { MAX_KEYS_PER_READ, type IssueTrackerProvider } from './providers/IssueTrackerProvider';
import { TRACKER_PROVIDERS } from './providers/trackerProviders';
import { pollForToken, requestDeviceCode, type Wait } from './signIn/deviceFlow';
import { signInFailureOf } from './signIn/signInFailures';
import type { ConnectionHttp, TrackerHttp } from './TrackerHttp';
import { TrackerError } from './TrackerError';
import type { TrackerCredential, TrackerSecrets } from './TrackerSecrets';
import { SupersededSearches } from './supersededSearches';
import { TokenPages } from './tokenPages';

export interface IssueTrackersDeps {
  store: IssueTrackerStore;
  secrets: TrackerSecrets;
  http: TrackerHttp;
  /** Tells every window what changed (`issueTrackersChanged`). */
  changed: (setup: IssueTrackerSetup) => void;
  newId: () => string;
  now: () => number;
  /** The device flow's wait between polls. */
  wait: Wait;
  /** The GitHub Apps the device flow signs in with, by host (`GITHUB_APPS`). */
  githubApps: Readonly<Record<string, GitHubApp>>;
  providers?: Readonly<Record<IssueTrackerKind, IssueTrackerProvider>>;
  /** Opens a web page in the browser (`shell.openExternal`): the token pages. */
  openExternal: (url: string) => void;
  /**
   * Asks the user, in main's own dialog over the calling window, whether to sign in to `server`: a window can't answer
   * it. True when allowed.
   */
  askHostConsent: (server: string, kind: IssueTrackerKind) => Promise<boolean>;
}

type Failed = { kind: 'failed'; failure: SignInFailure };

const failed = (failure: SignInFailure): Failed => ({ kind: 'failed', failure });

interface DeviceFlow {
  canceling: AbortController;
  outcome: Promise<SignInOutcome>;
  /** The window that started it (its web contents' id): closing it cancels the flow. */
  ownerId?: number;
}

/**
 * The trackers' engine in main (docs/features/issue-trackers.md): signs in, keeps connections and bindings, and reads
 * issues, each tracker's calls through its provider and every request through `TrackerHttp`. No credential leaves it.
 */
export class IssueTrackers {
  private readonly providers: Readonly<Record<IssueTrackerKind, IssueTrackerProvider>>;
  /** Connections whose credential the tracker refused this session: their reads fail at once, unsent. */
  private readonly refused = new Set<string>();
  private readonly flows = new Map<string, DeviceFlow>();
  /** The hosts the user allowed this session (`needsHostConsent`); once a connection is kept, its server needs none. */
  private readonly consentedServers = new Set<string>();
  /** The question on screen for a host, which every sign-in to it meanwhile waits for. */
  private readonly consentAsked = new Map<string, Promise<boolean>>();

  private readonly tokenPages: TokenPages;
  private readonly searches = new SupersededSearches();

  constructor(private readonly deps: IssueTrackersDeps) {
    this.providers = deps.providers ?? TRACKER_PROVIDERS;
    this.tokenPages = new TokenPages(deps.http);
  }

  setup(): IssueTrackerSetup {
    const { store, secrets } = this.deps;
    const connections = store.connections().map((connection) => this.withCredential(connection));
    // Every window reads the setup as it shows comments: the keychain is asked only once a tracker is connected.
    const sessionOnly = connections.length > 0 && !secrets.canKeep();
    return { connections, bindings: [...store.bindings()], sessionOnly, deviceFlowHosts: deviceFlowHostsOf(this.deps.githubApps) };
  }

  async signInWithToken(request: LinkSignIn & { token: string }): Promise<SignInOutcome> {
    const reading = this.readLink(request.link);
    if ('failure' in reading) return failed(reading.failure);
    const credential = this.credentialOf(reading.kind, request.token, request.email);
    if ('failure' in credential) return failed(credential.failure);
    return this.completeSignIn(reading, request.repository, credential, 'token');
  }

  async signInAgain({ connectionId, email, token }: { connectionId: string; email?: string; token: string }): Promise<SignInOutcome> {
    const connection = this.deps.store.connection(connectionId);
    if (!connection) return failed({ reason: 'unexpected', message: 'This sign-in is gone' });
    const credential = this.credentialOf(connection.kind, token, email ?? connection.account.email);
    if ('failure' in credential) return failed(credential.failure);
    return this.renewCredential(connection, credential, 'token');
  }

  /** A connection's new credential, kept once it signs in; its bindings stay. */
  private async renewCredential(connection: StoredConnection, credential: TrackerCredential, method: SignInMethodKind): Promise<SignInOutcome> {
    const provider = this.providers[connection.kind];
    try {
      const signedIn = await provider.signIn(this.deps.http.bound(provider.origins(connection.server), provider.authorization(credential)), connection.server);
      const updated: StoredConnection = {
        ...connection,
        account: { ...signedIn.account, ...(credential.email && { email: credential.email }) },
        signInMethod: method,
        ...(signedIn.apiBase && { apiBase: signedIn.apiBase }),
      };
      this.keep(updated, credential);
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(updated) };
    } catch (error) {
      return failed(signInFailureOf(error, connection.server));
    }
  }

  async retrySignIn(connectionId: string): Promise<SignInOutcome> {
    const connection = this.deps.store.connection(connectionId);
    if (!connection) return failed({ reason: 'unexpected', message: 'This sign-in is gone' });
    // Tried past the refusal, which only a success lifts: out of reach or rate limited, it stays refused.
    try {
      await this.providers[connection.kind].whoAmI(this.connectionHttp(connection, { pastRefusal: true }), connection);
      this.refused.delete(connectionId);
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(connection) };
    } catch (error) {
      this.announce();
      return failed(signInFailureOf(error, connection.server));
    }
  }

  async openTokenPage(target: TokenPageTarget, choice: TokenPageChoice = 'usual'): Promise<void> {
    const tracker = this.trackerOf(target);
    if (tracker) this.deps.openExternal(await this.tokenPages.urlOf(tracker, choice));
  }

  /** A first sign-in by a link, for a repository or alone; or a connection's again, by its id, its bindings kept. */
  async startDeviceSignIn(request: LinkSignIn | { connectionId: string }, ownerId?: number): Promise<DeviceSignIn | { failure: SignInFailure }> {
    const again = 'connectionId' in request ? this.deps.store.connection(request.connectionId) : undefined;
    const reading = 'connectionId' in request ? (again ?? { failure: { reason: 'unexpected', message: 'This sign-in is gone' } as const }) : this.readLink(request.link);
    if ('failure' in reading) return reading;
    const clientId = this.deps.githubApps[new URL(reading.server).hostname]?.clientId ?? '';
    if (reading.kind !== 'github' || !clientId) return { failure: { reason: 'unexpected', message: 'This tracker has no browser sign-in' } };
    const device = { server: reading.server, clientId };
    const http = this.deps.http.bound([new URL(reading.server).origin], null);
    let code;
    try {
      code = await requestDeviceCode(http, device, this.deps.now());
    } catch (error) {
      return { failure: signInFailureOf(error, reading.server) };
    }
    const flowId = this.deps.newId();
    const canceling = new AbortController();
    // Its outcome is kept until its window takes it (`finishDeviceSignIn`), cancels it, or closes (`windowClosed`).
    const outcome = pollForToken(http, device, code, this.deps.wait, this.deps.now, canceling.signal).then(
      (end) => {
        if (!('token' in end)) return failed({ reason: end.failed === 'unexpected' ? 'tokenRefused' : end.failed });
        if (again) return this.renewCredential(again, { token: end.token }, 'deviceCode');
        return 'link' in request && 'project' in reading ? this.completeSignIn(reading, request.repository, { token: end.token }, 'deviceCode') : failed({ reason: 'canceled' });
      },
      (error: unknown) => (canceling.signal.aborted ? failed({ reason: 'canceled' }) : failed(signInFailureOf(error, reading.server))),
    );
    this.flows.set(flowId, { canceling, outcome, ...(ownerId !== undefined && { ownerId }) });
    return { flowId, userCode: code.userCode, verificationUri: code.verificationUri, expiresAt: code.expiresAt };
  }

  async finishDeviceSignIn(flowId: string): Promise<SignInOutcome> {
    const flow = this.flows.get(flowId);
    if (!flow) return failed({ reason: 'canceled' });
    try {
      return await flow.outcome;
    } finally {
      this.flows.delete(flowId);
    }
  }

  cancelDeviceSignIn(flowId: string): void {
    this.flows.get(flowId)?.canceling.abort();
  }

  /** A window closed: the device flows it started stop, and are forgotten once ended. */
  windowClosed(ownerId: number): void {
    for (const [flowId, flow] of this.flows) {
      if (flow.ownerId !== ownerId) continue;
      flow.canceling.abort();
      void flow.outcome.finally(() => this.flows.delete(flowId));
    }
  }

  async useConnection(request: RepositorySignIn & { connectionId: string }): Promise<SignInOutcome> {
    const reading = this.readLink(request.link);
    if ('failure' in reading) return failed(reading.failure);
    const connection = coveringConnection(this.deps.store.connections(), reading.kind, reading.server, reading.project);
    if (connection?.id !== request.connectionId) return failed({ reason: 'projectUnreadable', project: reading.project });
    return this.bindProven(connection, request.repository, [reading.project], reading.project);
  }

  async addProject(request: RepositorySignIn): Promise<SignInOutcome> {
    const reading = this.readLink(request.link);
    if ('failure' in reading) return failed(reading.failure);
    const binding = this.deps.store.bindings().find((kept) => sameRepository(kept.repository, request.repository));
    const connection = binding && this.deps.store.connection(binding.connectionId);
    if (!binding || !connection || coveringConnection([connection], reading.kind, reading.server, reading.project) === undefined) {
      return failed({ reason: 'projectUnreadable', project: reading.project });
    }
    const projects = binding.projects.includes(reading.project) ? binding.projects : [...binding.projects, reading.project];
    return this.bindProven(connection, request.repository, projects, reading.project);
  }

  removeProject(repository: string, project: string): void {
    const binding = this.bindingOf(repository);
    if (!binding || binding.projects.length < 2 || !binding.projects.includes(project)) return;
    this.deps.store.bind({ ...binding, projects: binding.projects.filter((kept) => kept !== project) });
    this.announce();
  }

  /**
   * Each bound project's name and counts (`projectAccess`), for Settings: a project that can't be read shows its key
   * alone. Nothing is asked of a connection that needs signing in again; every project out of reach is the tracker
   * out of reach.
   */
  async readProjects(repository: string): Promise<BoundProjectsAnswer> {
    const binding = this.bindingOf(repository);
    const connection = binding && this.deps.store.connection(binding.connectionId);
    if (!binding || !connection) return { kind: 'failed', reason: 'unexpected' };
    let http: ConnectionHttp;
    try {
      http = this.connectionHttp(connection);
    } catch {
      return { kind: 'failed', reason: 'signInRefused' };
    }
    const provider = this.providers[connection.kind];
    const failures: TrackerErrorReason[] = [];
    const projects = await Promise.all(
      binding.projects.map(async (project): Promise<BoundProject> => {
        try {
          return { project, access: await provider.projectAccess(http, connection, project) };
        } catch (error) {
          failures.push(error instanceof TrackerError ? error.reason : 'unexpected');
          return { project };
        }
      }),
    );
    const everyOne = (reason: TrackerErrorReason) => failures.length === projects.length && failures.every((failure) => failure === reason);
    if (everyOne('unreachable')) return { kind: 'failed', reason: 'unreachable' };
    if (failures.includes('signInRefused')) return { kind: 'failed', reason: 'signInRefused' };
    return { kind: 'read', projects };
  }

  private bindingOf(repository: string) {
    return this.deps.store.bindings().find((kept) => sameRepository(kept.repository, repository));
  }

  disconnect(repository: string): void {
    this.deps.store.unbind(repository);
    this.announce();
  }

  signOut(connectionId: string): void {
    this.deps.store.removeConnection(connectionId);
    this.deps.secrets.forget(connectionId);
    this.refused.delete(connectionId);
    this.announce();
  }

  /** A repository renamed in the app keeps its tracker. */
  repositoryRenamed(from: string, to: string): void {
    this.deps.store.renameRepository(from, to);
    this.announce();
  }

  /**
   * The issues named, in batches of `MAX_KEYS_PER_READ`, one request each. A connection whose credential is missing or
   * refused reads nothing, and a failure answers every key of its batch as unreadable, with when to try again.
   */
  async readIssues(connectionId: string, keys: readonly string[]): Promise<IssueRead[]> {
    const connection = this.deps.store.connection(connectionId);
    if (!connection) return keys.map((key) => ({ key, kind: 'unreadable', reason: 'signInRefused' }));
    const provider = this.providers[connection.kind];
    const reads: IssueRead[] = [];
    for (let start = 0; start < keys.length; start += MAX_KEYS_PER_READ) {
      const batch = keys.slice(start, start + MAX_KEYS_PER_READ);
      try {
        reads.push(...(await provider.readIssues(this.connectionHttp(connection), connection, batch)));
      } catch (error) {
        const reason = error instanceof TrackerError ? error.reason : 'unexpected';
        const retryAt = error instanceof TrackerError ? error.until : undefined;
        reads.push(...batch.map((key): IssueRead => ({ key, kind: 'unreadable', reason, ...(retryAt !== undefined && { retryAt }) })));
      }
    }
    return reads;
  }

  /**
   * A `#` search of the repository's bound projects, in one request (docs/features/issue-trackers.md, "Suggesting
   * issues"). A newer search by the same window for the same repository aborts this one, which answers `superseded`.
   */
  async searchIssues(repository: string, search: IssueSearch, ownerId?: number): Promise<IssueSearchAnswer> {
    const binding = this.deps.store.bindings().find((kept) => sameRepository(kept.repository, repository));
    const connection = binding && this.deps.store.connection(binding.connectionId);
    if (!binding || !connection) return { kind: 'failed', reason: 'unexpected' };
    const owner = `${ownerId ?? 'main'}:${repository}`;
    const signal = this.searches.start(owner);
    try {
      const http = this.connectionHttp(connection);
      const searching: ConnectionHttp = { ...http, send: (request) => http.send({ ...request, signal }) };
      const issues = await this.providers[connection.kind].searchIssues(searching, connection, binding.projects, search);
      return signal.aborted ? { kind: 'superseded' } : { kind: 'found', connectionId: connection.id, issues };
    } catch (error) {
      if (signal.aborted) return { kind: 'superseded' };
      const reason = error instanceof TrackerError ? error.reason : 'unexpected';
      const retryAt = error instanceof TrackerError ? error.until : undefined;
      return { kind: 'failed', reason, ...(retryAt !== undefined && { retryAt }) };
    } finally {
      this.searches.finish(owner, signal);
    }
  }

  /** The tracker a token page is for: a link's, read here, or a kept connection's. */
  private trackerOf(target: TokenPageTarget): { kind: IssueTrackerKind; server: string } | null {
    if ('connectionId' in target) return this.deps.store.connection(target.connectionId) ?? null;
    const reading = this.readLink(target.link);
    return 'failure' in reading ? null : reading;
  }

  private readLink(link: string): RecognizedLink | { failure: SignInFailure } {
    const reading = recognizeTrackerLink(link);
    if (!isRecognizedLink(reading)) return { failure: { reason: 'notAnIssueLink', ...('notAnIssue' in reading && { what: reading.notAnIssue }) } };
    if (!reading.server.startsWith('https:')) return { failure: { reason: 'insecure' } };
    return reading;
  }

  /** The token a sign-in uses, trimmed; a text of no token's shape is never sent. */
  private credentialOf(kind: IssueTrackerKind, typed: string, email: string | undefined): TrackerCredential | { failure: SignInFailure } {
    const token = typed.trim();
    if (TRACKER_GRAMMARS[kind].tokenShape(token) === 'none') return { failure: { reason: 'tokenShape' } };
    if (kind === 'jiraCloud' && !email?.trim()) return { failure: { reason: 'emailNeeded' } };
    return { token, ...(kind === 'jiraCloud' && { email: email!.trim() }) };
  }

  private async completeSignIn(reading: RecognizedLink, repository: string | undefined, credential: TrackerCredential, method: SignInMethodKind): Promise<SignInOutcome> {
    if (!(await this.hostAllowed(reading.server, reading.kind))) return failed({ reason: 'hostDeclined', server: reading.server });
    const provider = this.providers[reading.kind];
    let signedIn;
    try {
      signedIn = await provider.signIn(this.deps.http.bound(provider.origins(reading.server), provider.authorization(credential)), reading.server);
    } catch (error) {
      return failed(signInFailureOf(error, reading.server));
    }
    // A fine-grained GitHub token covers one owner; a classic one, or the device flow's, every owner.
    const scope = reading.kind === 'github' ? (credential.token.startsWith('github_pat_') ? ownerOf(reading.project) : '*') : undefined;
    const existing = this.deps.store.connections().find((kept) => kept.kind === reading.kind && kept.server === reading.server && kept.scope === scope);
    const connection: StoredConnection = {
      id: existing?.id ?? this.deps.newId(),
      kind: reading.kind,
      server: reading.server,
      ...(scope && { scope }),
      account: { ...signedIn.account, ...(credential.email && { email: credential.email }) },
      signInMethod: method,
      access: 'read',
      ...(signedIn.apiBase && { apiBase: signedIn.apiBase }),
    };
    this.keep(connection, credential);
    return this.bindProven(connection, repository, [reading.project], reading.project);
  }

  /**
   * Whether a credential may go to `server`: a tracker's own host, a connection's, or one the user allowed. One question
   * per host at a time: sign-ins on their way wait for its answer. A decline isn't remembered: the next sign-in is the
   * user's own paste again, and asks again.
   */
  private async hostAllowed(server: string, kind: IssueTrackerKind): Promise<boolean> {
    const key = server.toLowerCase();
    if (this.consentedServers.has(key) || !needsHostConsent(server, this.deps.store.connections())) return true;
    return this.consentAsked.get(key) ?? this.askConsent(key, server, kind);
  }

  private askConsent(key: string, server: string, kind: IssueTrackerKind): Promise<boolean> {
    const asked = this.deps
      .askHostConsent(server, kind)
      .catch(() => false)
      .then((allowed) => {
        if (allowed) this.consentedServers.add(key);
        return allowed;
      })
      .finally(() => this.consentAsked.delete(key));
    this.consentAsked.set(key, asked);
    return asked;
  }

  /**
   * Proves `project` with the connection, then binds the repository to it (none: a sign-in alone, from a window with no
   * repository); nothing is bound when the project can't be read.
   */
  private async bindProven(connection: StoredConnection, repository: string | undefined, projects: string[], project: string): Promise<SignInOutcome> {
    try {
      const access = await this.providers[connection.kind].projectAccess(this.connectionHttp(connection), connection, project);
      if (repository) this.deps.store.bind({ repository, connectionId: connection.id, projects });
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(connection), access };
    } catch (error) {
      this.announce();
      return failed(signInFailureOf(error, connection.server, project));
    }
  }

  private keep(connection: StoredConnection, credential: TrackerCredential): void {
    this.deps.secrets.keep(connection.id, credential);
    this.refused.delete(connection.id);
    this.deps.store.saveConnection(connection);
  }

  /** The connection's HTTP, its credential added; a missing or refused credential fails at once, unsent. */
  private connectionHttp(connection: StoredConnection, { pastRefusal = false } = {}): ConnectionHttp {
    const credential = this.refused.has(connection.id) && !pastRefusal ? null : this.deps.secrets.read(connection.id);
    if (!credential) throw new TrackerError('signInRefused', `${new URL(connection.server).host} needs signing in again`);
    const provider = this.providers[connection.kind];
    return this.deps.http.bound(provider.origins(connection.server), provider.authorization(credential), () => this.credentialRefused(connection.id));
  }

  private credentialRefused(connectionId: string): void {
    if (this.refused.has(connectionId)) return;
    this.refused.add(connectionId);
    this.announce();
  }

  private withCredential(connection: StoredConnection): TrackerConnection {
    return { ...connection, credential: this.refused.has(connection.id) ? 'refused' : this.deps.secrets.state(connection.id) };
  }

  private announce(): void {
    this.deps.changed(this.setup());
  }
}
