import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeTrackerHttp } from '../testing/fakeTrackerHttp';
import { deviceCodeOf, nextDevicePoll, pollForToken, realWait, requestDeviceCode, type Wait } from './deviceFlow';

const SERVER = { server: 'https://github.com', clientId: 'Iv1.abc', scopes: 'repo' };
const CODE_URL = 'POST https://github.com/login/device/code';
const TOKEN_URL = 'POST https://github.com/login/oauth/access_token';

/** GitHub's device code answer. */
const DEVICE_CODE = { device_code: '3584d83530557fdd1f46af8289938c8ef79f9dc5', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 };

describe('nextDevicePoll', () => {
  it('waits the interval while the user hasn’t approved yet', () => {
    expect(nextDevicePoll(5_000, 900_000, { error: 'authorization_pending' }, 10_000)).toEqual({ kind: 'wait', intervalMs: 5_000 });
  });

  it('slows down by the server’s new interval, or five seconds more', () => {
    expect(nextDevicePoll(5_000, 900_000, { error: 'slow_down', interval: 10 }, 0)).toEqual({ kind: 'wait', intervalMs: 10_000 });
    expect(nextDevicePoll(5_000, 900_000, { error: 'slow_down' }, 0)).toEqual({ kind: 'wait', intervalMs: 10_000 });
  });

  it('ends with the token, a denial, or an expired code', () => {
    expect(nextDevicePoll(5_000, 900_000, { access_token: 'gho_abc', token_type: 'bearer', scope: 'repo' }, 0)).toEqual({ kind: 'done', token: 'gho_abc' });
    expect(nextDevicePoll(5_000, 900_000, { error: 'access_denied' }, 0)).toEqual({ kind: 'failed', reason: 'denied' });
    expect(nextDevicePoll(5_000, 900_000, { error: 'expired_token' }, 0)).toEqual({ kind: 'failed', reason: 'expired' });
    expect(nextDevicePoll(5_000, 900_000, { error: 'authorization_pending' }, 900_000)).toEqual({ kind: 'failed', reason: 'expired' });
    expect(nextDevicePoll(5_000, 900_000, { error: 'incorrect_client_credentials' }, 0)).toEqual({ kind: 'failed', reason: 'unexpected' });
  });

  it('reads the device code answer', () => {
    expect(deviceCodeOf(DEVICE_CODE, 1_000)).toEqual({ deviceCode: DEVICE_CODE.device_code, userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresAt: 901_000, intervalMs: 5_000 });
    expect(deviceCodeOf({ error: 'unauthorized_client' }, 0)).toBeNull();
  });
});

/** `realWait` with no time to wait: what it does with the signal is what the test is about. */
const realWaitAtOnce: Wait = (_ms, signal) => realWait(0, signal);

describe('the device flow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a code, then polls at the server’s pace until approved', async () => {
    const tracker = fakeTrackerHttp({
      [CODE_URL]: { json: DEVICE_CODE },
      [TOKEN_URL]: [{ json: { error: 'authorization_pending' } }, { json: { error: 'slow_down', interval: 10 } }, { json: { access_token: 'gho_token', token_type: 'bearer', scope: 'repo' } }],
    });
    const http = tracker.http.bound(['https://github.com'], null);
    const code = await requestDeviceCode(http, SERVER, 0);
    expect(tracker.requests[0]!.form).toEqual({ client_id: 'Iv1.abc', scope: 'repo' });

    const waits: number[] = [];
    const wait = async (ms: number) => {
      waits.push(ms);
    };
    expect(await pollForToken(http, SERVER, code, wait, () => 0, new AbortController().signal)).toEqual({ token: 'gho_token' });
    expect(waits).toEqual([5_000, 5_000, 10_000]);
    expect(tracker.lines()).toEqual([CODE_URL, TOKEN_URL, TOKEN_URL, TOKEN_URL]);
    expect(tracker.requests[1]!.form).toEqual({ client_id: 'Iv1.abc', device_code: DEVICE_CODE.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
  });

  it('waits with a timer before each poll', async () => {
    vi.useFakeTimers();
    let waited = false;
    void realWait(5_000, new AbortController().signal).then(() => {
      waited = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(waited).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(waited).toBe(true);
  });

  it('stops polling when canceled', async () => {
    vi.useFakeTimers();
    const tracker = fakeTrackerHttp({ [TOKEN_URL]: { json: { error: 'authorization_pending' } } });
    const canceling = new AbortController();
    const code = { deviceCode: 'd', userCode: 'U', verificationUri: 'https://github.com/login/device', expiresAt: 900_000, intervalMs: 5_000 };
    const polled = pollForToken(tracker.http.bound(['https://github.com'], null), SERVER, code, realWait, () => Date.now(), canceling.signal);
    canceling.abort();
    expect(await polled).toEqual({ failed: 'canceled' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tracker.requests).toEqual([]);
  });

  it('stops when canceled while a poll is on its way, asking no more', async () => {
    const canceling = new AbortController();
    const tracker = fakeTrackerHttp({
      [TOKEN_URL]: () => {
        canceling.abort();
        return { json: { error: 'authorization_pending' } };
      },
    });
    const code = { deviceCode: 'd', userCode: 'U', verificationUri: 'https://github.com/login/device', expiresAt: 900_000, intervalMs: 5_000 };
    const polled = pollForToken(tracker.http.bound(['https://github.com'], null), SERVER, code, realWaitAtOnce, () => 0, canceling.signal);
    expect(await polled).toEqual({ failed: 'canceled' });
    expect(tracker.lines()).toEqual([TOKEN_URL]);
  });

  it('waits no time at all on a signal already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(realWait(5_000, aborted.signal)).rejects.toThrow('canceled');
  });
});
