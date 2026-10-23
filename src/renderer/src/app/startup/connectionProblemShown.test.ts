import { describe, expect, it } from 'vitest';
import type { ConnectionProblem } from '@shared/domain/setup';
import { connectionProblemShown, serverToCheck } from './connectionProblemShown';

const problem = (server: string): ConnectionProblem => ({ kind: 'serverUnreachable', server, commandLine: `cm checkconnection ${server}`, output: '' });

describe('connectionProblemShown', () => {
  it("shows the server problem of the window's place, a workspace or a repository explored without one", () => {
    expect(connectionProblemShown(problem('codice@cloud'), { placeOpen: true, dismissedServer: null })).toEqual(problem('codice@cloud'));
  });

  it('shows nothing while the check runs or once the server answers', () => {
    expect(connectionProblemShown(undefined, { placeOpen: true, dismissedServer: null })).toBeNull();
    expect(connectionProblemShown(null, { placeOpen: true, dismissedServer: null })).toBeNull();
  });

  it('shows nothing on the home screen, which works without any server', () => {
    expect(connectionProblemShown(problem('codice@cloud'), { placeOpen: false, dismissedServer: null })).toBeNull();
  });

  it("hides a server's problem once dismissed, but not another server's", () => {
    expect(connectionProblemShown(problem('codice@cloud'), { placeOpen: true, dismissedServer: 'codice@cloud' })).toBeNull();
    expect(connectionProblemShown(problem('local'), { placeOpen: true, dismissedServer: 'codice@cloud' })).toEqual(problem('local'));
  });
});

describe('serverToCheck', () => {
  it("checks the open workspace's server once cm is known to be configured", () => {
    expect(serverToCheck(null, 'codice@cloud')).toBe('codice@cloud');
  });

  it('checks none while the setup check runs, or when cm has no configuration', () => {
    expect(serverToCheck(undefined, 'codice@cloud')).toBeUndefined();
    expect(serverToCheck({ commandLine: 'cm profile list', output: 'not correctly configured' }, 'codice@cloud')).toBeUndefined();
  });

  it('checks none on the home screen, where no workspace is open', () => {
    expect(serverToCheck(null, undefined)).toBeUndefined();
  });
});
