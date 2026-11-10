import type { ConnectionHttp } from '../TrackerHttp';
import { TrackerError } from '../TrackerError';
import { isRecord, numberOf, stringOf } from '../providers/IssueTrackerProvider';

/** What the device flow's first request answers (RFC 8628, 3.2): the code the user enters, and how often to ask. */
export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalMs: number;
}

/** What polling decides from each answer: wait and ask again, the token, or why the sign-in ended. */
export type DevicePollStep = { kind: 'wait'; intervalMs: number } | { kind: 'done'; token: string } | { kind: 'failed'; reason: 'denied' | 'expired' | 'unexpected' };

/** RFC 8628's default interval, when the server names none; `slow_down` adds five seconds to it (3.5). */
const DEFAULT_INTERVAL_MS = 5_000;
const SLOW_DOWN_MS = 5_000;

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** The device code answer, read; null when it isn't one. */
export function deviceCodeOf(body: unknown, now: number): DeviceCode | null {
  if (!isRecord(body)) return null;
  const deviceCode = stringOf(body.device_code);
  const userCode = stringOf(body.user_code);
  const verificationUri = stringOf(body.verification_uri);
  const expiresIn = numberOf(body.expires_in);
  if (!deviceCode || !userCode || !verificationUri || expiresIn === undefined) return null;
  return { deviceCode, userCode, verificationUri, expiresAt: now + expiresIn * 1000, intervalMs: (numberOf(body.interval) ?? DEFAULT_INTERVAL_MS / 1000) * 1000 };
}

/**
 * The next step of the device flow's polling (RFC 8628, 3.5), from the token endpoint's answer: still pending, wait
 * the interval; `slow_down`, wait five seconds longer from now on; the token; denied or expired, end.
 */
export function nextDevicePoll(intervalMs: number, expiresAt: number, answer: unknown, now: number): DevicePollStep {
  if (isRecord(answer)) {
    const token = stringOf(answer.access_token);
    if (token) return { kind: 'done', token };
    switch (stringOf(answer.error)) {
      case 'authorization_pending':
        return now >= expiresAt ? { kind: 'failed', reason: 'expired' } : { kind: 'wait', intervalMs };
      case 'slow_down':
        return now >= expiresAt ? { kind: 'failed', reason: 'expired' } : { kind: 'wait', intervalMs: (numberOf(answer.interval) ?? (intervalMs + SLOW_DOWN_MS) / 1000) * 1000 };
      case 'expired_token':
        return { kind: 'failed', reason: 'expired' };
      case 'access_denied':
        return { kind: 'failed', reason: 'denied' };
    }
  }
  return { kind: 'failed', reason: 'unexpected' };
}

/** Waits `ms`, or rejects when `signal` aborts: the polling's only timer, passed in so tests advance it. */
export type Wait = (ms: number, signal: AbortSignal) => Promise<void>;

export const realWait: Wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    // A listener added to a signal already aborted never hears it: it rejects at once instead.
    if (signal.aborted) return reject(new Error('canceled'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('canceled'));
      },
      { once: true },
    );
  });

export interface DeviceFlowServer {
  /** `https://github.com`: the device and token endpoints are its `/login/device/code` and `/login/oauth/access_token`. */
  server: string;
  /** A GitHub App's: its permissions say what the token reads, so no scope is asked. */
  clientId: string;
}

/** Asks the server for a device code. */
export async function requestDeviceCode(http: ConnectionHttp, { server, clientId }: DeviceFlowServer, now: number): Promise<DeviceCode> {
  const response = await http.send({ method: 'POST', url: `${server}/login/device/code`, form: { client_id: clientId } });
  const code = response.status === 200 ? deviceCodeOf(response.body, now) : null;
  if (!code) throw new TrackerError('unexpected', `${new URL(server).host} gave no sign-in code`);
  return code;
}

export type DeviceFlowEnd = { token: string } | { failed: 'denied' | 'expired' | 'unexpected' | 'canceled' };

/**
 * Polls the token endpoint at the server's pace until the user approves, denies, the code expires, or `signal` aborts:
 * a cancel during a poll on its way ends it as that poll answers, its answer unused, even a token.
 */
export async function pollForToken(http: ConnectionHttp, { server, clientId }: DeviceFlowServer, code: DeviceCode, wait: Wait, now: () => number, signal: AbortSignal): Promise<DeviceFlowEnd> {
  let intervalMs = code.intervalMs;
  for (;;) {
    try {
      await wait(intervalMs, signal);
    } catch (error) {
      if (signal.aborted) return { failed: 'canceled' };
      throw error;
    }
    const response = await http.send({ method: 'POST', url: `${server}/login/oauth/access_token`, form: { client_id: clientId, device_code: code.deviceCode, grant_type: DEVICE_GRANT } });
    if (signal.aborted) return { failed: 'canceled' };
    const step = nextDevicePoll(intervalMs, code.expiresAt, response.body, now());
    if (step.kind === 'done') return { token: step.token };
    if (step.kind === 'failed') return { failed: step.reason };
    intervalMs = step.intervalMs;
  }
}
