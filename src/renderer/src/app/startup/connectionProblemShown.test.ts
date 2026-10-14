import { describe, expect, it } from 'vitest';
import type { ConnectionProblem } from '@shared/domain/setup';
import { connectionProblemShown, serverToCheck } from './connectionProblemShown';

const problem = (server: string): ConnectionProblem => ({ kind: 'serverUnreachable', server, commandLine: `cm checkconnection ${server}`, output: '' });

describe('connectionProblemShown', () => {
  it("shows the open workspace's server problem", () => {
    expect(connectionProblemShown(problem('codice@cloud'), { workspaceOpen: true, dismissedServer: null })).toEqual(problem('codice@cloud'));
  });

  it('shows nothing while the check runs or once the server answers', () => {
    expect(connectionProblemShown(undefined, { workspaceOpen: true, dismissedServer: null })).toBeNull();
    expect(connectionProblemShown(null, { workspaceOpen: true, dismissedServer: null })).toBeNull();
  });

  it('shows nothing on the home screen, which works without any server', () => {
    expect(connectionProblemShown(problem('codice@cloud'), { workspaceOpen: false, dismissedServer: null })).toBeNull();
  });

  it("hides a server's problem once dismissed, but not another server's", () => {
    expect(connectionProblemShown(problem('codice@cloud'), { workspaceOpen: true, dismissedServer: 'codice@cloud' })).toBeNull();
    expect(connectionProblemShown(problem('local'), { workspaceOpen: true, dismissedServer: 'codice@cloud' })).toEqual(problem('local'));
  });
});

describe('serverToCheck', () => {
  it("checks the open workspace's server once cm is known to be configured", () => {
    expect(serverToCheck(null, { server: 'codice@cloud' })).toBe('codice@cloud');
  });

  it('checks none while the setup check runs, or when cm has no configuration', () => {
    expect(serverToCheck(undefined, { server: 'codice@cloud' })).toBeUndefined();
    expect(serverToCheck({ commandLine: 'cm profile list', output: 'not correctly configured' }, { server: 'codice@cloud' })).toBeUndefined();
  });

  it('checks none on the home screen, where no workspace is open', () => {
    expect(serverToCheck(null, undefined)).toBeUndefined();
  });
});
