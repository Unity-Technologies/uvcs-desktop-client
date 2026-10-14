import { describe, expect, it } from 'vitest';
import type { SetupProblem, SetupProblemKind } from '@shared/domain/setup';
import { setupProblemShown } from './setupProblemShown';

const problem = (kind: SetupProblemKind): SetupProblem => ({ kind, server: 'codice@cloud', commandLine: 'cm checkconnection', output: '' });

describe('setupProblemShown', () => {
  it('shows nothing while the check runs or once it passed', () => {
    expect(setupProblemShown(undefined, { cardDismissed: false })).toBeNull();
    expect(setupProblemShown(null, { cardDismissed: false })).toBeNull();
  });

  it('stops the app when cm has no configuration at all, as no server can work', () => {
    expect(setupProblemShown(problem('notConfigured'), { cardDismissed: false })).toBe('screen');
    expect(setupProblemShown(problem('notConfigured'), { cardDismissed: true })).toBe('screen');
  });

  it('leaves the app working when the server is out of reach or the sign-in fails: the home screen and other servers need neither', () => {
    expect(setupProblemShown(problem('serverUnreachable'), { cardDismissed: false })).toBe('card');
    expect(setupProblemShown(problem('notSignedIn'), { cardDismissed: false })).toBe('card');
  });

  it('hides the card once dismissed', () => {
    expect(setupProblemShown(problem('serverUnreachable'), { cardDismissed: true })).toBeNull();
    expect(setupProblemShown(problem('notSignedIn'), { cardDismissed: true })).toBeNull();
  });
});
