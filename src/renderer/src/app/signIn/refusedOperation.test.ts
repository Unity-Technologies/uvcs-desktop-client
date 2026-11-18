import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { SignInProblem } from '@shared/domain/signIn';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { ApiError } from '../../api/client';
import { pressToastAction, shownToasts } from '../../testing/operationOutcome';
import { runAction, runOperation, runRead } from '../operations/runOperation';
import { useSession } from '../workspace/sessionStore';
import { useCommandLogStore } from '../shell/commandLogStore';
import { queryClient } from '../queryClient';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { forgetRefusedOperation, offerRefusedAgain } from './refusedOperation';

const WS = '/work/game';
const PLACE = workspacePlace(WS);

const problem = (server: string): SignInProblem => ({ kind: 'sessionEnded', server, details: { commandLine: `cm checkconnection ${server}`, output: '' } });
const refused = (server: string) =>
  new ApiError({ message: 'Sign in to this server again to continue.', signIn: problem(server), command: { commandLine: 'cm checkin', exitCode: 1, output: '', logEntryId: 42 } });

/** The workspace's info as the window read it: on acme@cloud. */
function workspaceOnAcme(): void {
  const info: WorkspaceInfo = { name: 'game', path: WS, repository: 'game@acme@cloud', repositoryName: 'game', server: 'acme@cloud', selector: { kind: 'branch', name: '/main' }, loadedChangeset: 1, kind: 'standard' };
  queryClient.setQueryData(workspaceInfoQuery(WS).queryKey, info);
}

/** A check-in whose every run fails with `error` the first `failures` times, then succeeds; counts its runs. */
function checkIn(error: Error, failures = 1) {
  let runs = 0;
  const run = () =>
    runOperation({
      title: 'Checking in',
      workspacePath: WS,
      run: async () => {
        runs++;
        if (runs <= failures) throw error;
        return 'cs:12';
      },
      success: () => ({ title: 'Checked in' }),
    });
  return { run, runs: () => runs };
}

beforeEach(() => {
  forgetRefusedOperation();
  useCommandLogStore.setState({ handledIds: new Set() });
  workspaceOnAcme();
});

describe('an operation refused for a sign-in', () => {
  it("raises no error toast, nor points at its command as a failure: the sign-in screen already tells", async () => {
    await checkIn(refused('acme@cloud')).run();

    expect(shownToasts()).toEqual([]);
    expect(useCommandLogStore.getState().handledIds.has(42)).toBe(true);
  });

  it('is offered again once its server is signed in, never run by itself', async () => {
    const checkin = checkIn(refused('acme@cloud'));
    await checkin.run();

    offerRefusedAgain('acme@cloud', PLACE);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Signed in to acme', detail: "Checking in didn't run.", action: 'Try again' }]);
    expect(checkin.runs()).toBe(1);
  });

  it('runs again as the user started it when they press Try again', async () => {
    const checkin = checkIn(refused('acme@cloud'));
    await checkin.run();
    offerRefusedAgain('acme@cloud', PLACE);

    pressToastAction('Signed in to acme');
    expect(checkin.runs()).toBe(2);
  });

  it('offers only the last one refused, and only once', async () => {
    await checkIn(refused('acme@cloud')).run();
    await runAction(PLACE, "Couldn't create the label", () => Promise.reject(refused('acme@cloud')));

    offerRefusedAgain('acme@cloud', PLACE);
    offerRefusedAgain('acme@cloud', PLACE);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Signed in to acme', detail: "Couldn't create the label", action: 'Try again' }]);
  });

  it('offers nothing once the window left the place, or for another server', async () => {
    await checkIn(refused('acme@cloud')).run();
    offerRefusedAgain('build:8087', PLACE);
    offerRefusedAgain('acme@cloud', repositoryPlace('game@acme@cloud'));

    expect(shownToasts()).toEqual([]);
  });

  it('offers nothing once forgotten as the window leaves the place', async () => {
    await checkIn(refused('acme@cloud')).run();
    forgetRefusedOperation();

    offerRefusedAgain('acme@cloud', PLACE);

    expect(shownToasts()).toEqual([]);
  });

  it("toasts as before for another server's sign-in, which covers no window here (an xlink's), and for any other failure", async () => {
    await checkIn(refused('build:8087')).run();
    await runAction(PLACE, "Couldn't create the label", () => Promise.reject(new ApiError({ message: 'The label already exists.' })));

    expect(shownToasts().map(({ kind, title }) => [kind, title])).toEqual([
      ['error', 'Checking in failed'],
      ['error', "Couldn't create the label"],
    ]);
  });

  it("toasts while the workspace's server isn't known yet: no screen can cover the window for it", async () => {
    queryClient.removeQueries({ queryKey: workspaceInfoQuery(WS).queryKey });

    await checkIn(refused('acme@cloud')).run();

    expect(shownToasts().map(({ title }) => title)).toEqual(['Checking in failed']);
  });
});

describe('a read refused for a sign-in', () => {
  it("raises no toast in a window whose place's server it is: the sign-in screen tells", async () => {
    useSession.getState().openWorkspace(WS);

    await runRead("Couldn't check what came in", () => Promise.reject(refused('acme@cloud')));

    expect(shownToasts()).toEqual([]);
  });

  it("toasts on the home screen, and for another server's sign-in", async () => {
    useSession.getState().openWorkspace(WS);
    await runRead("Couldn't check what came in", () => Promise.reject(refused('build:8087')));
    useSession.getState().goHome();
    await runRead("Couldn't list the repositories", () => Promise.reject(refused('acme@cloud')));

    expect(shownToasts().map(({ title }) => title)).toEqual(["Couldn't check what came in", "Couldn't list the repositories"]);
  });
});
