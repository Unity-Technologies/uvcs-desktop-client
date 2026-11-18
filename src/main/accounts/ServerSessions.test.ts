import { describe, expect, it } from 'vitest';
import type { ServerSession, SignInProblem } from '@shared/domain/signIn';
import { ServerSessions } from './ServerSessions';

const problem = (server: string, kind: SignInProblem['kind'] = 'sessionEnded'): SignInProblem => ({
  kind,
  server,
  details: { commandLine: `cm checkconnection ${server}`, output: 'Error: The auth token expired. User: dev@acme.com.' },
});

function watched() {
  const sessions = new ServerSessions();
  const told: ServerSession[][] = [];
  sessions.onChange((all) => told.push(all));
  return { sessions, told };
}

describe('ServerSessions', () => {
  it('takes a server it knows nothing of as signed in', () => {
    expect(new ServerSessions().of('acme@cloud')).toEqual({ server: 'acme@cloud', state: 'signedIn' });
    expect(new ServerSessions().all()).toEqual([]);
  });

  it('marks a server as needing a sign-in, and tells', () => {
    const { sessions, told } = watched();

    sessions.needsSignIn(problem('acme@cloud'));

    expect(sessions.of('acme@cloud')).toEqual({ server: 'acme@cloud', state: 'needsSignIn', problem: problem('acme@cloud') });
    expect(sessions.of('build:8087')).toEqual({ server: 'build:8087', state: 'signedIn' });
    expect(told).toEqual([[{ server: 'acme@cloud', state: 'needsSignIn', problem: problem('acme@cloud') }]]);
  });

  it('tells nothing when the same problem is told again, however many commands ran into it', () => {
    const { sessions, told } = watched();

    sessions.needsSignIn(problem('acme@cloud'));
    sessions.needsSignIn(problem('acme@cloud'));
    sessions.needsSignIn(problem('acme@cloud'));

    expect(told).toHaveLength(1);
  });

  it('tells when the reason changes', () => {
    const { sessions, told } = watched();

    sessions.needsSignIn(problem('acme@cloud'));
    sessions.needsSignIn(problem('acme@cloud', 'noLicense'));

    expect(told.at(-1)).toMatchObject([{ state: 'needsSignIn', problem: { kind: 'noLicense' } }]);
  });

  it('goes back to signed in, telling only when it needed a sign-in', () => {
    const { sessions, told } = watched();

    expect(sessions.signedIn('acme@cloud')).toBe(false);
    sessions.needsSignIn(problem('acme@cloud'));
    sessions.needsSignIn(problem('build:8087'));

    expect(sessions.signedIn('acme@cloud')).toBe(true);
    expect(sessions.of('acme@cloud').state).toBe('signedIn');
    expect(told.at(-1)).toEqual([{ server: 'build:8087', state: 'needsSignIn', problem: problem('build:8087') }]);
    expect(told).toHaveLength(3);
  });
});
