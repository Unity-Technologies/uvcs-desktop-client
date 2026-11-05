import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup } from '@shared/domain/issueTrackers';
import { IssueTrackers } from './IssueTrackers';
import { IssueTrackerStore } from './IssueTrackerStore';
import type { Wait } from './signIn/deviceFlow';
import { fakeTrackerHttp, type TrackerAnswers } from './testing/fakeTrackerHttp';
import { TrackerSecrets, type SecretCipher } from './TrackerSecrets';

const TOKEN = `ghp_${'a'.repeat(36)}`;
const FINE_GRAINED = `github_pat_${'B'.repeat(60)}`;
const REPOSITORY = 'game@acme@unity';
const LINK = 'https://github.com/acme/game/issues/12';
const GRAPHQL = 'POST https://api.github.com/graphql';

const plainCipher: SecretCipher = { canKeep: () => true, encrypt: (text) => Buffer.from(text).reverse(), decrypt: (data) => Buffer.from(data).reverse().toString() };

/** `GET /user` and the access query, as GitHub answers them. */
const SIGNED_IN: TrackerAnswers = {
  'GET https://api.github.com/user': { json: { login: 'ana-diaz', name: 'Ana Díaz' } },
  [GRAPHQL]: (request) =>
    String((request.json as { query: string }).query).startsWith('query Access')
      ? { json: { data: { repository: { nameWithOwner: 'acme/game', issues: { totalCount: 42 } }, search: { issueCount: 3 } } } }
      : { json: { data: { r0: { i0: { __typename: 'Issue', number: 12, title: 'Crash', url: LINK, state: 'OPEN', assignees: { nodes: [] } } } } } },
};

/** A wait that never ends by itself, only when canceled: the poll it holds back is never sent. */
const waitUntilCanceled: Wait = (_ms, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('canceled'))));

function trackers(answers: TrackerAnswers = {}, { consent = (() => false) as (server: string) => boolean, cipher = plainCipher, clientIds = { 'github.com': '' }, wait = (async () => undefined) as Wait } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'trackers-'));
  const tracker = fakeTrackerHttp(answers);
  const announced: IssueTrackerSetup[] = [];
  const opened: string[] = [];
  let ids = 0;
  const engine = new IssueTrackers({
    store: new IssueTrackerStore(join(folder, 'issue-trackers.json')),
    secrets: new TrackerSecrets(join(folder, 'secrets.json'), cipher),
    http: tracker.http,
    changed: (setup) => announced.push(setup),
    newId: () => `id${++ids}`,
    now: () => 0,
    wait,
    oauthClientIds: clientIds,
    openExternal: (url) => opened.push(url),
    askHostConsent: async (server) => consent(server),
  });
  return { engine, tracker, announced, opened };
}

describe('IssueTrackers', () => {
  it('signs in with a token, proves the project and binds the repository to it', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    const outcome = await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: ` ${TOKEN} ` });
    expect(outcome).toEqual({
      kind: 'signedIn',
      connection: { id: 'id1', kind: 'github', server: 'https://github.com', scope: '*', account: { id: 'ana-diaz', name: 'Ana Díaz' }, signInMethod: 'token', access: 'read', credential: 'kept' },
      access: { project: 'acme/game', name: 'acme/game', openIssues: 42, assignedToYou: 3 },
    });
    expect(engine.setup().bindings).toEqual([{ repository: REPOSITORY, connectionId: 'id1', projects: ['acme/game'] }]);
    expect(tracker.lines()).toEqual(['GET https://api.github.com/user', GRAPHQL]);
    expect(JSON.stringify(announced)).not.toContain(TOKEN);
  });

  it('opens the tracker’s token page from main', () => {
    const { engine, opened } = trackers();
    engine.openTokenPage({ link: LINK });
    expect(opened).toEqual(['https://github.com/settings/tokens/new?scopes=repo&description=UVCS%20Desktop']);
  });

  it('sends nothing for a text that isn’t a token, nor for Jira without an email, nor for a link that isn’t an issue', async () => {
    const { engine, tracker } = trackers();
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: 'hello there' })).toEqual({ kind: 'failed', failure: { reason: 'tokenShape' } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'https://acme.atlassian.net/browse/VCS-1', token: `ATATT${'x'.repeat(40)}` })).toEqual({ kind: 'failed', failure: { reason: 'emailNeeded' } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'https://acme.atlassian.net/jira/software/projects/VCS/boards/1', token: TOKEN })).toEqual({
      kind: 'failed',
      failure: { reason: 'notAnIssueLink', what: 'a Jira board' },
    });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'http://git.acme.com/a/b/issues/1', token: TOKEN })).toEqual({ kind: 'failed', failure: { reason: 'insecure' } });
    expect(tracker.requests).toEqual([]);
  });

  it('asks before sending a credential to a host no tracker is known by, and sends nothing when declined', async () => {
    const asked: string[] = [];
    const { engine, tracker } = trackers({}, { consent: (server) => (asked.push(server), false) });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'https://evil.example/a/b/issues/1', token: TOKEN })).toEqual({ kind: 'failed', failure: { reason: 'hostDeclined', server: 'https://evil.example' } });
    expect(asked).toEqual(['https://evil.example']);
    expect(tracker.requests).toEqual([]);
  });

  it('signs in to a host the user allowed, asking once for the session', async () => {
    const asked: string[] = [];
    const ENTERPRISE: TrackerAnswers = {
      'GET https://git.acme.com/api/v3/user': { json: { login: 'ana' } },
      'POST https://git.acme.com/api/graphql': { json: { data: { repository: { nameWithOwner: 'tools/build', issues: { totalCount: 1 } }, search: { issueCount: 0 } } } },
    };
    const { engine } = trackers(ENTERPRISE, { consent: (server) => (asked.push(server), true) });
    const link = 'https://git.acme.com/tools/build/issues/9';
    expect((await engine.signInWithToken({ repository: REPOSITORY, link, token: TOKEN })).kind).toBe('signedIn');
    expect((await engine.signInWithToken({ repository: 'other@acme@unity', link, token: TOKEN })).kind).toBe('signedIn');
    expect(asked).toEqual(['https://git.acme.com']);
  });

  it('asks nothing for github.com or Jira Cloud', async () => {
    const asked: string[] = [];
    const { engine } = trackers(SIGNED_IN, { consent: (server) => (asked.push(server), false) });
    expect((await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN })).kind).toBe('signedIn');
    expect(asked).toEqual([]);
  });

  it('says a refused token is refused', async () => {
    const { engine } = trackers({ 'GET https://api.github.com/user': { status: 401 } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN })).toEqual({ kind: 'failed', failure: { reason: 'tokenRefused' } });
  });

  it('keeps the sign-in but binds nothing when the project can’t be read, naming it', async () => {
    const { engine } = trackers({ ...SIGNED_IN, [GRAPHQL]: { json: { data: { repository: null, search: { issueCount: 0 } }, errors: [{ type: 'NOT_FOUND', path: ['repository'] }] } } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN })).toEqual({ kind: 'failed', failure: { reason: 'projectUnreadable', project: 'acme/game' } });
    expect(engine.setup().connections).toHaveLength(1);
    expect(engine.setup().bindings).toEqual([]);
  });

  it('makes a connection per owner for a fine-grained token, never replacing another owner’s', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: FINE_GRAINED });
    await engine.signInWithToken({ repository: 'tools@acme@unity', link: 'https://github.com/Other/tools/issues/1', token: FINE_GRAINED });
    expect(engine.setup().connections.map((connection) => connection.scope)).toEqual(['acme', 'other']);
  });

  it('reuses a connection for a second repository, with no sign-in', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    const outcome = await engine.useConnection({ repository: 'racer@acme@unity', link: 'https://github.com/acme/game/issues/3', connectionId: 'id1' });
    expect(outcome.kind).toBe('signedIn');
    expect(tracker.lines().filter((line) => line.endsWith('/user'))).toHaveLength(1);
    expect(engine.setup().bindings.map((binding) => binding.repository)).toEqual([REPOSITORY, 'racer@acme@unity']);
  });

  it('adds a project of the same tracker to a binding', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    await engine.addProject({ repository: REPOSITORY, link: 'https://github.com/acme/tools/issues/1' });
    expect(engine.setup().bindings[0]!.projects).toEqual(['acme/game', 'acme/tools']);
    expect(await engine.addProject({ repository: REPOSITORY, link: 'https://acme.atlassian.net/browse/VCS-1' })).toMatchObject({ kind: 'failed' });
  });

  it('reads issues in one request per connection', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    const reads = await engine.readIssues('id1', ['acme/game#12']);
    expect(reads).toEqual([{ key: 'acme/game#12', kind: 'found', issue: expect.objectContaining({ title: 'Crash' }) }]);
    expect(tracker.lines().slice(2)).toEqual([GRAPHQL]);
  });

  it('marks a credential refused at the first 401 and sends nothing more until signed in again', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    tracker.answer({ [GRAPHQL]: { status: 401 }, 'GET https://api.github.com/user': [{ status: 401 }, { json: { login: 'ana-diaz' } }] });
    expect(await engine.readIssues('id1', ['acme/game#12'])).toEqual([{ key: 'acme/game#12', kind: 'unreadable', reason: 'signInRefused' }]);
    expect(announced.at(-1)!.connections[0]!.credential).toBe('refused');
    const sent = tracker.requests.length;
    expect(await engine.readIssues('id1', ['acme/game#12'])).toEqual([{ key: 'acme/game#12', kind: 'unreadable', reason: 'signInRefused' }]);
    expect(tracker.requests).toHaveLength(sent);

    expect(await engine.retrySignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'tokenRefused' } });
    expect(engine.setup().connections[0]!.credential).toBe('refused');
    expect((await engine.retrySignIn('id1')).kind).toBe('signedIn');
    expect(engine.setup().connections[0]!.credential).toBe('kept');
  });

  it('tries a refused credential again with one whoAmI, and announces it works again', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    tracker.answer({ [GRAPHQL]: { status: 401 } });
    await engine.readIssues('id1', ['acme/game#12']);
    expect(engine.setup().connections[0]!.credential).toBe('refused');
    const sent = tracker.requests.length;
    expect((await engine.retrySignIn('id1')).kind).toBe('signedIn');
    expect(tracker.lines().slice(sent)).toEqual(['GET https://api.github.com/user']);
    expect(announced.at(-1)!.connections[0]!.credential).toBe('kept');
  });

  it('keeps a credential refused when trying it again finds the tracker out of reach', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    tracker.answer({ [GRAPHQL]: { status: 401 }, 'GET https://api.github.com/user': { unreachable: true } });
    await engine.readIssues('id1', ['acme/game#12']);
    const told = announced.length;
    expect(await engine.retrySignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'unreachable', server: 'https://github.com' } });
    expect(engine.setup().connections[0]!.credential).toBe('refused');
    expect(announced.slice(told).map((setup) => setup.connections[0]!.credential)).not.toContain('kept');
  });

  it('keeps a credential refused when trying it again is refused too', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    tracker.answer({ 'GET https://api.github.com/user': { status: 401 } });
    expect(await engine.retrySignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'tokenRefused' } });
    expect(engine.setup().connections[0]!.credential).toBe('refused');
  });

  it('sends nothing trying again a credential the keychain won’t give back', async () => {
    const refusing: SecretCipher = {
      ...plainCipher,
      decrypt: () => {
        throw new Error('refused');
      },
    };
    const { engine, tracker } = trackers(SIGNED_IN, { cipher: refusing });
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    const sent = tracker.requests.length;
    expect(await engine.retrySignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'tokenRefused' } });
    expect(tracker.requests).toHaveLength(sent);
  });

  it('moves a binding with its repository’s rename, and tells every window', async () => {
    const { engine, announced } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    engine.repositoryRenamed(REPOSITORY, 'racer@acme@unity');
    expect(announced.at(-1)!.bindings.map((binding) => binding.repository)).toEqual(['racer@acme@unity']);
  });

  it('binds nothing with a connection that doesn’t cover the link', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: FINE_GRAINED });
    const sent = tracker.requests.length;
    expect(await engine.useConnection({ repository: 'tools@acme@unity', link: 'https://github.com/other/tools/issues/1', connectionId: 'id1' })).toEqual({
      kind: 'failed',
      failure: { reason: 'projectUnreadable', project: 'other/tools' },
    });
    expect(tracker.requests).toHaveLength(sent);
    expect(engine.setup().bindings.map((binding) => binding.repository)).toEqual([REPOSITORY]);
  });

  it('signs in again with a new token, keeping the bindings', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    const outcome = await engine.signInAgain({ connectionId: 'id1', token: `ghp_${'c'.repeat(36)}` });
    expect(outcome).toMatchObject({ kind: 'signedIn', connection: { id: 'id1', credential: 'kept' } });
    expect(engine.setup().bindings).toHaveLength(1);
  });

  it('reads nothing for a credential the keychain won’t give back', async () => {
    const { engine, tracker } = trackers(SIGNED_IN, {
      cipher: {
        ...plainCipher,
        decrypt: () => {
          throw new Error('refused');
        },
      },
    });
    expect((await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN })).kind).toBe('failed');
    const sent = tracker.requests.length;
    expect(engine.setup().connections[0]!.credential).toBe('missing');
    expect(await engine.readIssues('id1', ['acme/game#12'])).toEqual([{ key: 'acme/game#12', kind: 'unreadable', reason: 'signInRefused' }]);
    expect(tracker.requests).toHaveLength(sent);
  });

  it('answers every key of a rate-limited batch as unreadable until the limit ends', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    tracker.answer({ [GRAPHQL]: { status: 429, headers: { 'retry-after': '60' } } });
    expect(await engine.readIssues('id1', ['acme/game#12', 'acme/game#13'])).toEqual([
      { key: 'acme/game#12', kind: 'unreadable', reason: 'rateLimited', retryAt: 60_000 },
      { key: 'acme/game#13', kind: 'unreadable', reason: 'rateLimited', retryAt: 60_000 },
    ]);
  });

  it('signs in with GitHub’s device flow where an app is registered', async () => {
    const { engine, tracker } = trackers(
      {
        ...SIGNED_IN,
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
        'POST https://github.com/login/oauth/access_token': [{ json: { error: 'authorization_pending' } }, { json: { access_token: 'gho_token', token_type: 'bearer', scope: 'repo' } }],
      },
      { clientIds: { 'github.com': 'Iv1.app' } },
    );
    expect(engine.setup().deviceFlowHosts).toEqual(['github.com']);
    const started = await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK });
    expect(started).toEqual({ flowId: 'id1', userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresAt: 900_000 });
    expect(await engine.finishDeviceSignIn('id1')).toMatchObject({ kind: 'signedIn', connection: { signInMethod: 'deviceCode', scope: '*' } });
    expect(tracker.requests.find((request) => request.url.endsWith('/user'))!.headers.Authorization).toBe('Bearer gho_token');
  });

  it('signs a connection in again with the device flow, keeping its bindings', async () => {
    const { engine, tracker } = trackers(
      {
        ...SIGNED_IN,
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'C', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
        'POST https://github.com/login/oauth/access_token': { json: { access_token: 'gho_again', token_type: 'bearer', scope: 'repo' } },
      },
      { clientIds: { 'github.com': 'Iv1.app' } },
    );
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    const started = await engine.startDeviceSignIn({ connectionId: 'id1' });
    expect(started).toMatchObject({ userCode: 'C' });
    expect(await engine.finishDeviceSignIn((started as { flowId: string }).flowId)).toMatchObject({ kind: 'signedIn', connection: { id: 'id1', credential: 'kept', signInMethod: 'deviceCode' } });
    expect(tracker.requests.at(-1)!.headers.Authorization).toBe('Bearer gho_again');
    expect(engine.setup().bindings).toHaveLength(1);
  });

  it('ends a device flow the user cancels', async () => {
    const { engine } = trackers(
      {
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'C', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
      },
      { clientIds: { 'github.com': 'Iv1.app' }, wait: waitUntilCanceled },
    );
    await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK });
    engine.cancelDeviceSignIn('id1');
    expect(await engine.finishDeviceSignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'canceled' } });
  });

  it('binds nothing when the user cancels while a poll is on its way, and forgets the flow', async () => {
    let cancel = (): void => undefined;
    const { engine, tracker } = trackers(
      {
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'C', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
        'POST https://github.com/login/oauth/access_token': () => {
          cancel();
          return { json: { access_token: 'gho_token', token_type: 'bearer', scope: 'repo' } };
        },
      },
      { clientIds: { 'github.com': 'Iv1.app' } },
    );
    cancel = () => engine.cancelDeviceSignIn('id1');
    await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK });
    expect(await engine.finishDeviceSignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'canceled' } });
    expect(engine.setup().connections).toEqual([]);
    expect(tracker.lines().filter((line) => line.endsWith('/user'))).toEqual([]);
    expect(await engine.finishDeviceSignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'canceled' } });
  });

  it('keeps an ended device flow’s outcome until its window asks for it', async () => {
    const { engine } = trackers(
      {
        ...SIGNED_IN,
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'C', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
        'POST https://github.com/login/oauth/access_token': { json: { access_token: 'gho_token', token_type: 'bearer', scope: 'repo' } },
      },
      { clientIds: { 'github.com': 'Iv1.app' } },
    );
    await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK });
    await new Promise((resolve) => setImmediate(resolve));
    expect(engine.setup().connections).toHaveLength(1);
    expect((await engine.finishDeviceSignIn('id1')).kind).toBe('signedIn');
  });

  it('cancels the device flows of a window that closed', async () => {
    const { engine, tracker } = trackers(
      {
        'POST https://github.com/login/device/code': { json: { device_code: 'dev', user_code: 'C', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 } },
      },
      { clientIds: { 'github.com': 'Iv1.app' }, wait: waitUntilCanceled },
    );
    await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK }, 7);
    engine.windowClosed(7);
    expect(await engine.finishDeviceSignIn('id1')).toEqual({ kind: 'failed', failure: { reason: 'canceled' } });
    expect(tracker.lines()).toEqual(['POST https://github.com/login/device/code']);
  });

  it('offers no device flow without a registered app', async () => {
    const { engine, tracker } = trackers();
    expect(await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK })).toMatchObject({ failure: { reason: 'unexpected' } });
    expect(tracker.requests).toEqual([]);
  });

  it('asks nothing of the keychain while no tracker is connected: every window reads the setup', async () => {
    let asked = 0;
    const counting: SecretCipher = {
      ...plainCipher,
      canKeep: () => {
        asked++;
        return true;
      },
    };
    const { engine } = trackers(SIGNED_IN, { cipher: counting });
    expect(engine.setup()).toMatchObject({ connections: [], sessionOnly: false });
    expect(asked).toBe(0);
  });

  it('forgets a connection and its bindings on sign out, and a repository’s binding on disconnect', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, token: TOKEN });
    engine.disconnect(REPOSITORY);
    expect(engine.setup()).toMatchObject({ bindings: [], connections: [{ id: 'id1' }] });
    engine.signOut('id1');
    expect(engine.setup()).toMatchObject({ bindings: [], connections: [] });
  });
});
