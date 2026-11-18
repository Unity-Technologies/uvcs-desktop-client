import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ServerSession, SignInProblem } from '@shared/domain/signIn';
import { ApiError } from '../../api/client';
import { failedForSignInTo, serverToKeepChecking, signedInAgain, signInCovering, signInProblemOf, toldBySignInScreen, workspaceSignInProblem } from './windowSignIn';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { WorkspaceInfo } from '@shared/domain/workspace';

const problem = (server: string): SignInProblem => ({ kind: 'sessionEnded', server, details: { commandLine: `cm checkconnection ${server}`, output: '' } });
const needs = (server: string): ServerSession => ({ server, state: 'needsSignIn', problem: problem(server) });
const refused = (server: string) => new ApiError({ message: `Sign in to ${server} to continue.`, signIn: problem(server) });

describe('signInCovering', () => {
  it("covers the window while its place's server needs a sign-in", () => {
    expect(signInCovering([needs('build:8087'), needs('acme@cloud')], 'acme@cloud')).toEqual(problem('acme@cloud'));
  });

  it("leaves a window on another server alone, and the home screen, and a place whose server isn't known yet", () => {
    expect(signInCovering([needs('build:8087')], 'acme@cloud')).toBeNull();
    expect(signInCovering([needs('acme@cloud')], undefined)).toBeNull();
    expect(signInCovering(undefined, 'acme@cloud')).toBeNull();
    expect(signInCovering([], 'acme@cloud')).toBeNull();
  });
});

describe('toldBySignInScreen', () => {
  it("is a failure for the sign-in of the window's place's server, which the screen covers the window for", () => {
    expect(signInProblemOf(refused('acme@cloud'))).toEqual(problem('acme@cloud'));
    expect(toldBySignInScreen(refused('acme@cloud'), 'acme@cloud')).toBe(true);
  });

  it("isn't another server's sign-in (an xlink's: no screen covers the window for it), any other failure, or one on the home screen", () => {
    expect(toldBySignInScreen(refused('build:8087'), 'acme@cloud')).toBe(false);
    expect(toldBySignInScreen(new ApiError({ message: 'The branch does not exist.' }), 'acme@cloud')).toBe(false);
    expect(toldBySignInScreen(new Error('offline'), 'acme@cloud')).toBe(false);
    expect(toldBySignInScreen(refused('acme@cloud'), undefined)).toBe(false);
  });
});

describe('signedInAgain', () => {
  it('names the servers that needed a sign-in and no longer do', () => {
    expect(signedInAgain([needs('acme@cloud'), needs('build:8087')], [needs('build:8087')])).toEqual(['acme@cloud']);
    expect(signedInAgain([], [needs('acme@cloud')])).toEqual([]);
    expect(signedInAgain([needs('acme@cloud')], [needs('acme@cloud')])).toEqual([]);
  });
});

describe('failedForSignInTo', () => {
  it("picks the queries whose last read failed for that server's sign-in, to read them once more", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fail = (key: string, error: Error) => client.prefetchQuery({ queryKey: [key], queryFn: () => Promise.reject(error) });
    await fail('branches', refused('acme@cloud'));
    await fail('labels', refused('build:8087'));
    await fail('changesets', new ApiError({ message: 'The branch does not exist.' }));
    client.setQueryData(['info'], 'read');

    const picked = client.getQueryCache().findAll({ predicate: failedForSignInTo('acme@cloud') });

    expect(picked.map((query) => query.queryKey)).toEqual([['branches']]);
  });
});

const INFO = { server: 'acme@cloud', repository: 'game@acme@cloud' } as WorkspaceInfo;

describe('workspaceSignInProblem', () => {
  it("is the sign-in a workspace's info couldn't be read for, while none was ever read", () => {
    expect(workspaceSignInProblem({ data: undefined, error: refused('acme@cloud') })).toEqual(problem('acme@cloud'));
  });

  it('is none once the info was read (a later failure keeps the screen), for any other failure, or while it reads', () => {
    expect(workspaceSignInProblem({ data: INFO, error: refused('acme@cloud') })).toBeNull();
    expect(workspaceSignInProblem({ data: undefined, error: new ApiError({ message: 'Not a workspace' }) })).toBeNull();
    expect(workspaceSignInProblem({ data: undefined, error: null })).toBeNull();
  });
});

describe('serverToKeepChecking', () => {
  it("is the place's server: a repository's from its spec, a workspace's from its info", () => {
    expect(serverToKeepChecking(repositoryPlace('game@acme@cloud'), { data: undefined, error: null })).toBe('acme@cloud');
    expect(serverToKeepChecking(workspacePlace('/wk'), { data: INFO, error: null })).toBe('acme@cloud');
  });

  it("is the server a workspace's info couldn't be read for, so coming back to its window checks it again", () => {
    expect(serverToKeepChecking(workspacePlace('/wk'), { data: undefined, error: refused('acme@cloud') })).toBe('acme@cloud');
  });

  it('is none on the home screen, or while the info reads', () => {
    expect(serverToKeepChecking(null, { data: undefined, error: null })).toBeUndefined();
    expect(serverToKeepChecking(workspacePlace('/wk'), { data: undefined, error: null })).toBeUndefined();
  });
});
