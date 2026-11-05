import { describe, expect, it, vi } from 'vitest';
import { fakeTrackerHttp } from './testing/fakeTrackerHttp';
import { TrackerError } from './TrackerError';

const ORIGINS = ['https://acme.atlassian.net'];
const MYSELF = 'https://acme.atlassian.net/rest/api/3/myself';

async function failureOf(promise: Promise<unknown>): Promise<TrackerError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof TrackerError)) throw new Error(`Expected a TrackerError, got ${String(error)}`);
  return error;
}

describe('TrackerHttp', () => {
  it('sends the credential with no cookies and no redirect followed, and reads the answer as JSON', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${MYSELF}`]: { json: { displayName: 'Ana' } } });
    const response = await tracker.http.bound(ORIGINS, 'Basic abc').send({ method: 'GET', url: MYSELF });
    expect(response.body).toEqual({ displayName: 'Ana' });
    expect(tracker.requests[0]).toMatchObject({ headers: { Authorization: 'Basic abc', Accept: 'application/json' }, redirect: 'manual', credentials: 'omit' });
  });

  it('never sends a request to an origin that isn’t the connection’s, nor over plain http', async () => {
    const tracker = fakeTrackerHttp();
    const http = tracker.http.bound(ORIGINS, 'Basic abc');
    expect((await failureOf(http.send({ method: 'GET', url: 'https://evil.example.com/steal' }))).reason).toBe('unexpected');
    expect((await failureOf(http.send({ method: 'GET', url: 'http://acme.atlassian.net/rest/api/3/myself' }))).reason).toBe('unexpected');
    expect(tracker.requests).toEqual([]);
  });

  it('fails a redirect, naming only where it led', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${MYSELF}`]: { status: 302, headers: { Location: 'https://login.example.com/sso?token=secret' } } });
    const error = await failureOf(tracker.http.bound(ORIGINS, 'Basic abc').send({ method: 'GET', url: MYSELF }));
    expect(error.reason).toBe('unexpected');
    expect(error.message).toBe('acme.atlassian.net/rest/api/3/myself sent the request elsewhere (login.example.com)');
  });

  it('tells a refused sign-in to the connection', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${MYSELF}`]: { status: 401 } });
    const refused = vi.fn();
    expect((await failureOf(tracker.http.bound(ORIGINS, 'Basic abc', refused).send({ method: 'GET', url: MYSELF }))).reason).toBe('signInRefused');
    expect(refused).toHaveBeenCalledOnce();
  });

  it('rests an origin that asked to wait, failing its next requests unsent until then', async () => {
    let now = 1_000;
    const tracker = fakeTrackerHttp({ [`GET ${MYSELF}`]: [{ status: 429, headers: { 'Retry-After': '30' } }, { json: {} }] }, { now: () => now });
    const http = tracker.http.bound(ORIGINS, null);
    const limited = await failureOf(http.send({ method: 'GET', url: MYSELF }));
    expect(limited).toMatchObject({ reason: 'rateLimited', until: 31_000 });
    expect((await failureOf(http.send({ method: 'GET', url: MYSELF }))).reason).toBe('rateLimited');
    expect(tracker.requests).toHaveLength(1);
    now = 31_001;
    await http.send({ method: 'GET', url: MYSELF });
    expect(tracker.requests).toHaveLength(2);
  });

  it('reads GitHub’s primary and secondary limits as rate limits, and a plain 403 as an answer', async () => {
    const url = 'https://api.github.com/user';
    const tracker = fakeTrackerHttp(
      {
        [`GET ${url}`]: [
          { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '50' } },
          { status: 403, json: { message: 'Resource not accessible' } },
        ],
      },
      { now: () => 0 },
    );
    const http = tracker.http.bound(['https://api.github.com'], 'Bearer t');
    expect(await failureOf(http.send({ method: 'GET', url }))).toMatchObject({ reason: 'rateLimited', until: 50_000 });
    const other = fakeTrackerHttp({ [`GET ${url}`]: { status: 403, json: { message: 'Resource not accessible' } } });
    expect((await other.http.bound(['https://api.github.com'], 'Bearer t').send({ method: 'GET', url })).status).toBe(403);
  });

  it('fails as unreachable when no answer comes', async () => {
    const tracker = fakeTrackerHttp({ [`GET ${MYSELF}`]: { unreachable: true } });
    expect((await failureOf(tracker.http.bound(ORIGINS, null).send({ method: 'GET', url: MYSELF }))).reason).toBe('unreachable');
  });

  it('logs the method, host and path, never the query', async () => {
    const url = 'https://acme.atlassian.net/rest/api/3/search?jql=secret';
    const tracker = fakeTrackerHttp({ [`GET ${url}`]: { json: {} } });
    await tracker.http.bound(ORIGINS, 'Basic abc').send({ method: 'GET', url });
    expect(tracker.logged).toEqual([{ method: 'GET', host: 'acme.atlassian.net', path: '/rest/api/3/search', startedAt: 0, durationMs: 0, httpStatus: 200 }]);
  });

  it('sends a form as one', async () => {
    const url = 'https://github.com/login/device/code';
    const tracker = fakeTrackerHttp({ [`POST ${url}`]: { json: {} } });
    await tracker.http.bound(['https://github.com'], null).send({ method: 'POST', url, form: { client_id: 'abc', scope: 'repo' } });
    expect(tracker.requests[0]).toMatchObject({ form: { client_id: 'abc', scope: 'repo' }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  });
});
