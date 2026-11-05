import type { RepositorySignIn } from '@shared/api/issueTrackers';
import type { DeviceSignIn, IssueRead, IssueTrackerKind, IssueTrackerSetup, SignInFailure, SignInMethodKind, SignInOutcome, TokenSource, TrackerConnection } from '@shared/domain/issueTrackers';
import { coveringConnection, ownerOf } from '@shared/issueTrackers/connections';
import { sameRepository } from '@shared/issueTrackers/issueReferences';
import { deviceFlowHostsOf, GITHUB_OAUTH_SCOPES } from '@shared/issueTrackers/signInMethods';
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

/** The system's clipboard, passed in: main reads a copied token there, and clears it once used. */
export interface TokenClipboard {
  read(): Promise<string>;
  clear(): void;
}

export interface IssueTrackersDeps {
  store: IssueTrackerStore;
  secrets: TrackerSecrets;
  http: TrackerHttp;
  clipboard: TokenClipboard;
  /** Tells every window what changed (`issueTrackersChanged`). */
  changed: (setup: IssueTrackerSetup) => void;
  newId: () => string;
  now: () => number;
  /** The device flow's wait between polls. */
  wait: Wait;
  /** OAuth apps' client ids by host (`GITHUB_OAUTH_CLIENT_IDS`). */
  oauthClientIds: Readonly<Record<string, string>>;
  providers?: Readonly<Record<IssueTrackerKind, IssueTrackerProvider>>;
}

type Failed = { kind: 'failed'; failure: SignInFailure };

const failed = (failure: SignInFailure): Failed => ({ kind: 'failed', failure });

interface DeviceFlow {
  canceling: AbortController;
  outcome: Promise<SignInOutcome>;
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

  constructor(private readonly deps: IssueTrackersDeps) {
    this.providers = deps.providers ?? TRACKER_PROVIDERS;
  }

  setup(): IssueTrackerSetup {
    const { store, secrets } = this.deps;
    const connections = store.connections().map((connection) => this.withCredential(connection));
    return { connections, bindings: [...store.bindings()], sessionOnly: !secrets.canKeep(), deviceFlowHosts: deviceFlowHostsOf(this.deps.oauthClientIds) };
  }

  async signInWithToken(request: RepositorySignIn & { source: TokenSource }): Promise<SignInOutcome> {
    const reading = this.readLink(request.link);
    if ('failure' in reading) return failed(reading.failure);
    const credential = await this.credentialOf(reading.kind, request.source, request.email);
    if ('failure' in credential) return failed(credential.failure);
    return this.completeSignIn(reading, request.repository, credential, 'token');
  }

  async signInAgain({ connectionId, email, source }: { connectionId: string; email?: string; source: TokenSource }): Promise<SignInOutcome> {
    const connection = this.deps.store.connection(connectionId);
    if (!connection) return failed({ reason: 'unexpected', message: 'This sign-in is gone' });
    const credential = await this.credentialOf(connection.kind, source, email ?? connection.account.email);
    if ('failure' in credential) return failed(credential.failure);
    const provider = this.providers[connection.kind];
    try {
      const signedIn = await provider.signIn(this.deps.http.bound(provider.origins(connection.server), provider.authorization(credential)), connection.server);
      const updated: StoredConnection = { ...connection, account: { ...signedIn.account, ...(credential.email && { email: credential.email }) }, ...(signedIn.apiBase && { apiBase: signedIn.apiBase }) };
      await this.keep(updated, credential);
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(updated) };
    } catch (error) {
      return failed(signInFailureOf(error, connection.server));
    }
  }

  async retrySignIn(connectionId: string): Promise<SignInOutcome> {
    const connection = this.deps.store.connection(connectionId);
    if (!connection) return failed({ reason: 'unexpected', message: 'This sign-in is gone' });
    this.refused.delete(connectionId);
    try {
      await this.providers[connection.kind].whoAmI(this.connectionHttp(connection), connection);
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(connection) };
    } catch (error) {
      this.announce();
      return failed(signInFailureOf(error, connection.server));
    }
  }

  async clipboardHoldsToken(kind: IssueTrackerKind): Promise<boolean> {
    return TRACKER_GRAMMARS[kind].tokenShape((await this.deps.clipboard.read()).trim()) === 'known';
  }

  async startDeviceSignIn(request: RepositorySignIn): Promise<DeviceSignIn | { failure: SignInFailure }> {
    const reading = this.readLink(request.link);
    if ('failure' in reading) return reading;
    const clientId = this.deps.oauthClientIds[new URL(reading.server).hostname] ?? '';
    if (reading.kind !== 'github' || !clientId) return { failure: { reason: 'unexpected', message: 'This tracker has no browser sign-in' } };
    const device = { server: reading.server, clientId, scopes: GITHUB_OAUTH_SCOPES };
    const http = this.deps.http.bound([new URL(reading.server).origin], null);
    let code;
    try {
      code = await requestDeviceCode(http, device, this.deps.now());
    } catch (error) {
      return { failure: signInFailureOf(error, reading.server) };
    }
    const flowId = this.deps.newId();
    const canceling = new AbortController();
    const outcome = pollForToken(http, device, code, this.deps.wait, this.deps.now, canceling.signal)
      .then(
        (end) => ('token' in end ? this.completeSignIn(reading, request.repository, { token: end.token }, 'deviceCode') : failed({ reason: end.failed === 'unexpected' ? 'tokenRefused' : end.failed })),
        (error: unknown) => (canceling.signal.aborted ? failed({ reason: 'canceled' }) : failed(signInFailureOf(error, reading.server))),
      )
      // A flow its window stopped waiting for (reloaded meanwhile) is forgotten once it ends.
      .finally(() => this.flows.delete(flowId));
    this.flows.set(flowId, { canceling, outcome });
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

  private readLink(link: string): RecognizedLink | { failure: SignInFailure } {
    const reading = recognizeTrackerLink(link);
    if (!isRecognizedLink(reading)) return { failure: { reason: 'notAnIssueLink', ...('notAnIssue' in reading && { what: reading.notAnIssue }) } };
    if (!reading.server.startsWith('https:')) return { failure: { reason: 'insecure' } };
    return reading;
  }

  /** The token a sign-in uses, trimmed: typed, or read from the clipboard here, never from the window. */
  private async credentialOf(kind: IssueTrackerKind, source: TokenSource, email: string | undefined): Promise<TrackerCredential | { failure: SignInFailure }> {
    const token = ('copied' in source ? await this.deps.clipboard.read() : source.token).trim();
    const shape = TRACKER_GRAMMARS[kind].tokenShape(token);
    if (shape === 'none' || ('copied' in source && shape !== 'known')) return { failure: { reason: 'tokenShape' } };
    if (kind === 'jiraCloud' && !email?.trim()) return { failure: { reason: 'emailNeeded' } };
    return { token, ...(kind === 'jiraCloud' && { email: email!.trim() }) };
  }

  private async completeSignIn(reading: RecognizedLink, repository: string, credential: TrackerCredential, method: SignInMethodKind): Promise<SignInOutcome> {
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
    await this.keep(connection, credential);
    return this.bindProven(connection, repository, [reading.project], reading.project);
  }

  /** Proves `project` with the connection, then binds the repository to it; nothing is bound when the project can't be read. */
  private async bindProven(connection: StoredConnection, repository: string, projects: string[], project: string): Promise<SignInOutcome> {
    try {
      const access = await this.providers[connection.kind].projectAccess(this.connectionHttp(connection), connection, project);
      this.deps.store.bind({ repository, connectionId: connection.id, projects });
      this.announce();
      return { kind: 'signedIn', connection: this.withCredential(connection), access };
    } catch (error) {
      this.announce();
      return failed(signInFailureOf(error, connection.server, project));
    }
  }

  private async keep(connection: StoredConnection, credential: TrackerCredential): Promise<void> {
    this.deps.secrets.keep(connection.id, credential);
    this.refused.delete(connection.id);
    this.deps.store.saveConnection(connection);
    // A token pasted from the clipboard isn't left there to be pasted somewhere by mistake.
    if ((await this.deps.clipboard.read()).trim() === credential.token) this.deps.clipboard.clear();
  }

  /** The connection's HTTP, its credential added; a missing or refused credential fails at once, unsent. */
  private connectionHttp(connection: StoredConnection): ConnectionHttp {
    const credential = this.refused.has(connection.id) ? null : this.deps.secrets.read(connection.id);
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
