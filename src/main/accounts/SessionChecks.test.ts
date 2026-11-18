import { describe, expect, it } from 'vitest';
import type { ConnectionProblem } from '@shared/domain/setup';
import type { SignInProblem } from '@shared/domain/signIn';
import type { ConnectionCheck } from '../cm/connectionCheck';
import { ServerSessions } from './ServerSessions';
import { CONFIRMED_REACHED_MS, SESSION_CHECK_STALE_MS, SessionChecks } from './SessionChecks';

const ENDED: SignInProblem = { kind: 'sessionEnded', server: 'acme@cloud', details: { commandLine: 'cm checkconnection acme@cloud', output: 'Error: The auth token expired. User: dev@acme.com.' } };
const REFUSED: ConnectionProblem = { server: 'acme@cloud', commandLine: 'cm checkconnection acme@cloud', output: 'Error: Connection refused' };
const UNREACHABLE: ConnectionCheck = { kind: 'unreachable', problem: REFUSED };

/** Checks answered by `answer` (the latest one set), each counted, on a clock the test moves. */
function checks(first: ConnectionCheck = { kind: 'reached' }) {
  let time = 1_000_000;
  let answer = first;
  const asked: string[] = [];
  const pending: (() => void)[] = [];
  let holding = false;
  let restarts = 0;
  const sessions = new ServerSessions();
  const sessionChecks = new SessionChecks({
    check: (server) => {
      asked.push(server);
      const answered = answer;
      if (!holding) return Promise.resolve(answered);
      return new Promise((resolve) => pending.push(() => resolve(answered)));
    },
    sessions,
    restartShells: () => void restarts++,
    now: () => time,
  });
  return {
    checks: sessionChecks,
    sessions,
    asked,
    restarts: () => restarts,
    answer: (check: ConnectionCheck) => void (answer = check),
    advance: (ms: number) => void (time += ms),
    at: () => time,
    /** Checks wait until `release`. */
    hold: () => void (holding = true),
    release: () => pending.splice(0).forEach((resolve) => resolve()),
  };
}

describe('SessionChecks', () => {
  it('checks a server the first time, then not again while fresh: a window brought forward asks the server nothing', async () => {
    const { checks: sessionChecks, asked, advance } = checks();

    expect(await sessionChecks.whenStale('acme@cloud')).toBeNull();
    advance(SESSION_CHECK_STALE_MS - 1);
    await sessionChecks.whenStale('acme@cloud');

    expect(asked).toEqual(['acme@cloud']);
  });

  it('checks again once stale, which keeps the session alive', async () => {
    const { checks: sessionChecks, asked, advance } = checks();

    await sessionChecks.whenStale('acme@cloud');
    advance(SESSION_CHECK_STALE_MS);
    await sessionChecks.whenStale('acme@cloud');

    expect(asked).toEqual(['acme@cloud', 'acme@cloud']);
  });

  it('runs one check for two windows asking at once', async () => {
    const { checks: sessionChecks, asked, hold, release } = checks();
    hold();

    const first = sessionChecks.whenStale('acme@cloud');
    const second = sessionChecks.whenStale('acme@cloud');
    const third = sessionChecks.checkNow('acme@cloud');
    release();
    await Promise.all([first, second, third]);

    expect(asked).toEqual(['acme@cloud']);
  });

  it('checks a server that needs a sign-in on every activation, so signing in elsewhere is found', async () => {
    const { checks: sessionChecks, sessions, asked, answer, restarts } = checks({ kind: 'needsSignIn', problem: ENDED });

    await sessionChecks.whenStale('acme@cloud');
    expect(sessions.of('acme@cloud')).toMatchObject({ state: 'needsSignIn', problem: ENDED });
    await sessionChecks.whenStale('acme@cloud');
    answer({ kind: 'reached' });
    await sessionChecks.whenStale('acme@cloud');

    expect(asked).toHaveLength(3);
    expect(sessions.of('acme@cloud').state).toBe('signedIn');
    expect(restarts()).toBe(1);
  });

  it.each(['credentialsRefused', 'locked'] as const)(
    "doesn't check a server whose %s on activation: each check sends the refused password again, toward a lockout",
    async (kind) => {
      const { checks: sessionChecks, asked } = checks({ kind: 'needsSignIn', problem: { ...ENDED, kind } });

      await sessionChecks.whenStale('acme@cloud');
      await sessionChecks.whenStale('acme@cloud');
      await sessionChecks.whenStale('acme@cloud');
      expect(asked).toHaveLength(1);

      await sessionChecks.checkNow('acme@cloud');
      expect(asked).toHaveLength(2);
    },
  );

  it('restarts the shells only when a server signs in again, not on every check that finds it signed in', async () => {
    const { checks: sessionChecks, restarts } = checks();

    await sessionChecks.checkNow('acme@cloud');
    await sessionChecks.checkNow('acme@cloud');

    expect(restarts()).toBe(0);
  });

  it('checks every time it is asked to now, fresh or not: "Check again"', async () => {
    const { checks: sessionChecks, asked } = checks();

    await sessionChecks.checkNow('acme@cloud');
    await sessionChecks.checkNow('acme@cloud');

    expect(asked).toHaveLength(2);
  });

  it('answers a server out of reach without changing its sign-in state, and the answer holds while fresh', async () => {
    const { checks: sessionChecks, sessions, asked } = checks(UNREACHABLE);

    expect(await sessionChecks.whenStale('acme@cloud')).toEqual(REFUSED);
    expect(await sessionChecks.whenStale('acme@cloud')).toEqual(REFUSED);

    expect(sessions.all()).toEqual([]);
    expect(asked).toHaveLength(1);
  });

  it('keeps servers apart', async () => {
    const { checks: sessionChecks, asked } = checks();

    await sessionChecks.whenStale('acme@cloud');
    await sessionChecks.whenStale('build:8087');

    expect(asked).toEqual(['acme@cloud', 'build:8087']);
  });
});

describe('SessionChecks.confirm', () => {
  it("confirms a command's sign-in failure with one check, which marks the server", async () => {
    const { checks: sessionChecks, sessions, asked, at } = checks({ kind: 'needsSignIn', problem: ENDED });

    expect(await sessionChecks.confirm('acme@cloud', at(), false)).toEqual(ENDED);

    expect(asked).toEqual(['acme@cloud']);
    expect(sessions.of('acme@cloud').state).toBe('needsSignIn');
  });

  it('checks nothing for a server already known to need a sign-in: a local command that fails so costs no check', async () => {
    const { checks: sessionChecks, asked, at, advance } = checks({ kind: 'needsSignIn', problem: ENDED });
    await sessionChecks.checkNow('acme@cloud');
    advance(10);

    expect(await sessionChecks.confirm('acme@cloud', at(), false)).toEqual(ENDED);

    expect(asked).toHaveLength(1);
  });

  it("answers null when the server's session is fine: the failure was another server's", async () => {
    const { checks: sessionChecks, at } = checks();

    expect(await sessionChecks.confirm('acme@cloud', at(), false)).toBeNull();
  });

  it('confirms a burst of failures with one check: those that started before a check took it', async () => {
    const { checks: sessionChecks, asked, at, advance, hold, release } = checks({ kind: 'needsSignIn', problem: ENDED });
    const startedAt = at();
    advance(10);
    hold();

    const confirming = [sessionChecks.confirm('acme@cloud', startedAt, false), sessionChecks.confirm('acme@cloud', startedAt, false)];
    release();
    expect(await Promise.all(confirming)).toEqual([ENDED, ENDED]);
    expect(await sessionChecks.confirm('acme@cloud', startedAt, false)).toEqual(ENDED);

    expect(asked).toEqual(['acme@cloud']);
  });

  it('checks again for a command that started after the last check, once that one is a few seconds old', async () => {
    const { checks: sessionChecks, asked, at, advance } = checks();

    await sessionChecks.checkNow('acme@cloud');
    advance(CONFIRMED_REACHED_MS);
    await sessionChecks.confirm('acme@cloud', at(), false);

    expect(asked).toHaveLength(2);
  });

  it("answers failures from a server just found signed in with that answer: an xlink's sign-in costs one check, not one per read", async () => {
    const { checks: sessionChecks, asked, at, advance } = checks();
    await sessionChecks.checkNow('acme@cloud');

    for (let read = 0; read < 5; read++) {
      advance(100);
      expect(await sessionChecks.confirm('acme@cloud', at(), false)).toBeNull();
    }

    expect(asked).toHaveLength(1);
  });

  it('answers null when the check itself fails, so the command fails as it did', async () => {
    const sessions = new ServerSessions();
    const sessionChecks = new SessionChecks({ check: () => Promise.reject(new Error('cm not found')), sessions, restartShells: () => undefined });

    expect(await sessionChecks.confirm('acme@cloud', 0, false)).toBeNull();
  });

  it("restarts the shells once when a shell's reads fail for a sign-in the check finds fine: made elsewhere since they started", async () => {
    const { checks: sessionChecks, asked, at, advance, restarts } = checks();
    const startedAt = at();
    advance(10);

    expect(await sessionChecks.confirm('acme@cloud', startedAt, true)).toBeNull();
    expect(await sessionChecks.confirm('acme@cloud', startedAt, true)).toBeNull();

    expect(asked).toHaveLength(1);
    expect(restarts()).toBe(1);
  });

  it("restarts no shell for a failure in a process of its own: it read the sign-in as it started", async () => {
    const { checks: sessionChecks, at, restarts } = checks();

    await sessionChecks.confirm('acme@cloud', at(), false);

    expect(restarts()).toBe(0);
  });
});
