import { describe, expect, it } from 'vitest';
import type { SetupProblem } from '@shared/domain/setup';
import { serverProblemWords } from './serverProblemWords';

const problem = (overrides: Partial<SetupProblem>): SetupProblem => ({ kind: 'serverUnreachable', commandLine: 'cm checkconnection', output: '', ...overrides });

describe('serverProblemWords', () => {
  it('names the server cm tried', () => {
    expect(serverProblemWords(problem({ server: 'codice@cloud' })).title).toBe("Can't reach codice@cloud");
    expect(serverProblemWords(problem({ kind: 'notSignedIn', server: 'codice@cloud' })).title).toBe("You're not signed in to codice@cloud");
  });

  it('says "the server" when the output named none, as when it gave no answer at all', () => {
    expect(serverProblemWords(problem({})).title).toBe("Can't reach the server");
  });
});
