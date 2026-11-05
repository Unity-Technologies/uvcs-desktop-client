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

function trackers(answers: TrackerAnswers = {}, { clipboardText = '', cipher = plainCipher, clientIds = { 'github.com': '' }, wait = (async () => undefined) as Wait } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'trackers-'));
  const tracker = fakeTrackerHttp(answers);
  const clipboard = { text: clipboardText };
  const announced: IssueTrackerSetup[] = [];
  let ids = 0;
  const engine = new IssueTrackers({
    store: new IssueTrackerStore(join(folder, 'issue-trackers.json')),
    secrets: new TrackerSecrets(join(folder, 'secrets.json'), cipher),
    http: tracker.http,
    clipboard: { read: async () => clipboard.text, clear: () => (clipboard.text = '') },
    changed: (setup) => announced.push(setup),
    newId: () => `id${++ids}`,
    now: () => 0,
    wait,
    oauthClientIds: clientIds,
  });
  return { engine, tracker, clipboard, announced };
}

describe('IssueTrackers', () => {
  it('signs in with a token, proves the project and binds the repository to it', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    const outcome = await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: ` ${TOKEN} ` } });
    expect(outcome).toEqual({
      kind: 'signedIn',
      connection: { id: 'id1', kind: 'github', server: 'https://github.com', scope: '*', account: { id: 'ana-diaz', name: 'Ana Díaz' }, signInMethod: 'token', access: 'read', credential: 'kept' },
      access: { project: 'acme/game', name: 'acme/game', openIssues: 42, assignedToYou: 3 },
    });
    expect(engine.setup().bindings).toEqual([{ repository: REPOSITORY, connectionId: 'id1', projects: ['acme/game'] }]);
    expect(tracker.lines()).toEqual(['GET https://api.github.com/user', GRAPHQL]);
    expect(JSON.stringify(announced)).not.toContain(TOKEN);
  });

  it('signs in with the token copied, read by main, and clears the clipboard after', async () => {
    const { engine, clipboard } = trackers(SIGNED_IN, { clipboardText: TOKEN });
    expect(await engine.clipboardHoldsToken('github')).toBe(true);
    expect(await engine.clipboardHoldsToken('jiraCloud')).toBe(false);
    expect((await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { copied: true } })).kind).toBe('signedIn');
    expect(clipboard.text).toBe('');
  });

  it('leaves a clipboard alone that holds something else', async () => {
    const { engine, clipboard } = trackers(SIGNED_IN, { clipboardText: 'notes' });
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    expect(clipboard.text).toBe('notes');
  });

  it('sends nothing for a text that isn’t a token, nor for Jira without an email, nor for a link that isn’t an issue', async () => {
    const { engine, tracker } = trackers();
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: 'hello there' } })).toEqual({ kind: 'failed', failure: { reason: 'tokenShape' } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'https://acme.atlassian.net/browse/VCS-1', source: { token: `ATATT${'x'.repeat(40)}` } })).toEqual({ kind: 'failed', failure: { reason: 'emailNeeded' } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'https://acme.atlassian.net/jira/software/projects/VCS/boards/1', source: { token: TOKEN } })).toEqual({
      kind: 'failed',
      failure: { reason: 'notAnIssueLink', what: 'a Jira board' },
    });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: 'http://git.acme.com/a/b/issues/1', source: { token: TOKEN } })).toEqual({ kind: 'failed', failure: { reason: 'insecure' } });
    expect(tracker.requests).toEqual([]);
  });

  it('says a refused token is refused', async () => {
    const { engine } = trackers({ 'GET https://api.github.com/user': { status: 401 } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } })).toEqual({ kind: 'failed', failure: { reason: 'tokenRefused' } });
  });

  it('keeps the sign-in but binds nothing when the project can’t be read, naming it', async () => {
    const { engine } = trackers({ ...SIGNED_IN, [GRAPHQL]: { json: { data: { repository: null, search: { issueCount: 0 } }, errors: [{ type: 'NOT_FOUND', path: ['repository'] }] } } });
    expect(await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } })).toEqual({ kind: 'failed', failure: { reason: 'projectUnreadable', project: 'acme/game' } });
    expect(engine.setup().connections).toHaveLength(1);
    expect(engine.setup().bindings).toEqual([]);
  });

  it('makes a connection per owner for a fine-grained token, never replacing another owner’s', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: FINE_GRAINED } });
    await engine.signInWithToken({ repository: 'tools@acme@unity', link: 'https://github.com/Other/tools/issues/1', source: { token: FINE_GRAINED } });
    expect(engine.setup().connections.map((connection) => connection.scope)).toEqual(['acme', 'other']);
  });

  it('reuses a connection for a second repository, with no sign-in', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    const outcome = await engine.useConnection({ repository: 'racer@acme@unity', link: 'https://github.com/acme/game/issues/3', connectionId: 'id1' });
    expect(outcome.kind).toBe('signedIn');
    expect(tracker.lines().filter((line) => line.endsWith('/user'))).toHaveLength(1);
    expect(engine.setup().bindings.map((binding) => binding.repository)).toEqual([REPOSITORY, 'racer@acme@unity']);
  });

  it('adds a project of the same tracker to a binding', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    await engine.addProject({ repository: REPOSITORY, link: 'https://github.com/acme/tools/issues/1' });
    expect(engine.setup().bindings[0]!.projects).toEqual(['acme/game', 'acme/tools']);
    expect(await engine.addProject({ repository: REPOSITORY, link: 'https://acme.atlassian.net/browse/VCS-1' })).toMatchObject({ kind: 'failed' });
  });

  it('reads issues in one request per connection', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    const reads = await engine.readIssues('id1', ['acme/game#12']);
    expect(reads).toEqual([{ key: 'acme/game#12', kind: 'found', issue: expect.objectContaining({ title: 'Crash' }) }]);
    expect(tracker.lines().slice(2)).toEqual([GRAPHQL]);
  });

  it('marks a credential refused at the first 401 and sends nothing more until signed in again', async () => {
    const { engine, tracker, announced } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
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

  it('signs in again with a new token, keeping the bindings', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    const outcome = await engine.signInAgain({ connectionId: 'id1', source: { token: `ghp_${'c'.repeat(36)}` } });
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
    expect((await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } })).kind).toBe('failed');
    const sent = tracker.requests.length;
    expect(engine.setup().connections[0]!.credential).toBe('missing');
    expect(await engine.readIssues('id1', ['acme/game#12'])).toEqual([{ key: 'acme/game#12', kind: 'unreadable', reason: 'signInRefused' }]);
    expect(tracker.requests).toHaveLength(sent);
  });

  it('answers every key of a rate-limited batch as unreadable until the limit ends', async () => {
    const { engine, tracker } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
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

  it('offers no device flow without a registered app', async () => {
    const { engine, tracker } = trackers();
    expect(await engine.startDeviceSignIn({ repository: REPOSITORY, link: LINK })).toMatchObject({ failure: { reason: 'unexpected' } });
    expect(tracker.requests).toEqual([]);
  });

  it('forgets a connection and its bindings on sign out, and a repository’s binding on disconnect', async () => {
    const { engine } = trackers(SIGNED_IN);
    await engine.signInWithToken({ repository: REPOSITORY, link: LINK, source: { token: TOKEN } });
    engine.disconnect(REPOSITORY);
    expect(engine.setup()).toMatchObject({ bindings: [], connections: [{ id: 'id1' }] });
    engine.signOut('id1');
    expect(engine.setup()).toMatchObject({ bindings: [], connections: [] });
  });
});
