import { fakeApi } from '../../testing/fakeWindow';
import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../queryClient';
import { WORKSPACE_HEADS_REFRESH, workspaceHeadsQuery, workspaceRepositoryQuery } from './workspaceQueries';

describe('workspaceRepositoryQuery', () => {
  it('asks cm about each recent workspace once a session, whatever order or company it comes back in', async () => {
    const client = new QueryClient();
    fakeApi.answer('workspaces.repositoryOf', (path: string) => `${path.slice(4)}@local`);
    const read = (paths: string[]) => Promise.all(paths.map((path) => client.fetchQuery(workspaceRepositoryQuery(path))));

    expect(await read(['/wk/game', '/wk/tools'])).toEqual(['game@local', 'tools@local']);
    // Opening docs makes it the most recent: only it is new.
    expect(await read(['/wk/docs', '/wk/game', '/wk/tools'])).toEqual(['docs@local', 'game@local', 'tools@local']);

    expect(fakeApi.argsOf('workspaces.repositoryOf').map(([path]) => path)).toEqual(['/wk/game', '/wk/tools', '/wk/docs']);
  });

  it('keeps the answer for the session, however long the home screen is away', async () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      fakeApi.answer('workspaces.repositoryOf', () => 'game@local');

      await client.fetchQuery(workspaceRepositoryQuery('/wk/game'));
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      await client.fetchQuery(workspaceRepositoryQuery('/wk/game'));

      expect(fakeApi.argsOf('workspaces.repositoryOf')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a workspace cm couldn't tell as unknown", async () => {
    fakeApi.answer('workspaces.repositoryOf', () => null);

    expect(await new QueryClient().fetchQuery(workspaceRepositoryQuery('/wk/game'))).toBeNull();
  });
});

describe('workspaceHeadsQuery', () => {
  let client: QueryClient;
  beforeEach(() => {
    client = createQueryClient();
    client.mount();
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    client.unmount();
    client.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  const { queryKey, ...query } = workspaceHeadsQuery(['/wk/game', '/wk/tools']);
  /** Lets the client handle what just happened (a focus, a list mounting) and run the reads it starts. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** A list of workspaces showing (a mounted `useWorkspaceHeads`): counts the reads, until `hide`. */
  function showList(reads: { count: number }): () => void {
    const observer = new QueryObserver(client, { queryKey, queryFn: async () => ++reads.count, ...WORKSPACE_HEADS_REFRESH });
    return observer.subscribe(() => {});
  }

  it('is refreshed as the rarely changing lists are', () => {
    expect(query).toMatchObject(WORKSPACE_HEADS_REFRESH);
  });

  it('never reads every workspace again on a window focus, however old', async () => {
    const reads = { count: 0 };
    showList(reads);
    await settle();

    vi.advanceTimersByTime(60 * 60_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    expect(reads.count).toBe(1);
  });

  it('reads them again when a list shows once they are five minutes old, not before', async () => {
    const reads = { count: 0 };
    showList(reads)();
    await settle();

    vi.advanceTimersByTime(4 * 60_000);
    showList(reads)();
    await settle();
    expect(reads.count).toBe(1);

    vi.advanceTimersByTime(2 * 60_000);
    showList(reads);
    await settle();
    expect(reads.count).toBe(2);
  });
});
