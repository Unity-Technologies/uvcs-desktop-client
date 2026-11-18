import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ServerSession, SignInProblem } from '@shared/domain/signIn';
import { ApiError } from '../../api/client';
import { failedForSignInTo, signedInAgain, signInCovering, signInProblemOf, toldBySignInScreen } from './windowSignIn';

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
