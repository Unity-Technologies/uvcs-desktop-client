import { fakeApi } from '../../testing/fakeWindow';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { workspaceRepositoryQuery } from './workspaceQueries';

describe('workspaceRepositoryQuery', () => {
  it('asks cm about each recent workspace once a session, whatever order or company it comes back in', async () => {
    const client = new QueryClient();
    fakeApi.answer('workspaces.repositoriesOf', (paths: string[]) => Object.fromEntries(paths.map((path) => [path, `${path.slice(4)}@local`])));
    const read = (paths: string[]) => Promise.all(paths.map((path) => client.fetchQuery(workspaceRepositoryQuery(path))));

    expect(await read(['/wk/game', '/wk/tools'])).toEqual(['game@local', 'tools@local']);
    // Opening docs makes it the most recent: only it is new.
    expect(await read(['/wk/docs', '/wk/game', '/wk/tools'])).toEqual(['docs@local', 'game@local', 'tools@local']);

    expect(fakeApi.argsOf('workspaces.repositoriesOf').map(([paths]) => paths)).toEqual([['/wk/game'], ['/wk/tools'], ['/wk/docs']]);
  });

  it("keeps a workspace cm couldn't tell as unknown", async () => {
    fakeApi.answer('workspaces.repositoriesOf', () => ({}));

    expect(await new QueryClient().fetchQuery(workspaceRepositoryQuery('/wk/game'))).toBeNull();
  });
});
