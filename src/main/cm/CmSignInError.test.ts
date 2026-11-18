import { describe, expect, it } from 'vitest';
import type { SignInProblem } from '@shared/domain/signIn';
import { CmSignInError } from './CmSignInError';

const NOT_RUN = { commandLine: 'cm find branch', exitCode: -1, output: 'Not run: sign in to local first.', logEntryId: 3 };
const problem = (server: string): SignInProblem => ({ kind: 'sessionEnded', server, details: { commandLine: `cm checkconnection ${server}`, output: '' } });

describe('CmSignInError', () => {
  it("says what to do in words that name no server as cm does: where nothing covers the window (Home's lists, an xlink's read), it shows as it is", () => {
    for (const server of ['local', '2398571046213@cloud', 'acme@unity']) {
      const error = new CmSignInError(problem(server), NOT_RUN);
      expect(error.message).toBe('Sign in to this server again to continue.');
      expect(error.problem.server).toBe(server);
    }
  });
});
