import { describe, expect, it } from 'vitest';
import type { ConnectionProblem } from '@shared/domain/setup';
import { connectionProblemShown } from './connectionProblemShown';

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
