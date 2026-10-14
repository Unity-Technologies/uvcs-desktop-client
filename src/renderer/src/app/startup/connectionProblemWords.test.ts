import { describe, expect, it } from 'vitest';
import type { ConnectionProblem } from '@shared/domain/setup';
import { connectionProblemWords } from './connectionProblemWords';

const problem = (kind: ConnectionProblem['kind']): ConnectionProblem => ({ kind, server: 'codice@cloud', commandLine: 'cm checkconnection codice@cloud', output: '' });

describe('connectionProblemWords', () => {
  it("names the workspace's server, and whether it's out of reach or wants a sign-in", () => {
    expect(connectionProblemWords(problem('serverUnreachable')).title).toBe("Can't reach codice@cloud");
    expect(connectionProblemWords(problem('notSignedIn')).title).toBe("You're not signed in to codice@cloud");
  });
});
