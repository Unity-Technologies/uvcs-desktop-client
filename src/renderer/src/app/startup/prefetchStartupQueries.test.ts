import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { prefetchStartupQueries } from './prefetchStartupQueries';

beforeEach(() => {
  fakeApi.answer('settings.get', () => DEFAULT_SETTINGS);
  fakeApi.answer('system.cmVersion', () => '11.0.16');
});

afterEach(() => {
  useSession.setState({ workspacePath: null });
  queryClient.clear();
});

describe('prefetchStartupQueries', () => {
  it('asks for what the home screen shows when the window starts there', async () => {
    fakeApi.answer('workspaces.list', () => []);
    fakeApi.answer('repositories.servers', () => []);

    await prefetchStartupQueries();

    expect(fakeApi.methods().sort()).toEqual(['repositories.servers', 'settings.get', 'system.cmVersion', 'workspaces.list']);
  });

  it("asks for what a workspace's Changes view shows when the window starts on it, not for the home screen's lists", async () => {
    useSession.setState({ workspacePath: '/wk' });
    fakeApi.answer('workspaces.info', () => ({}));
    fakeApi.answer('pendingChanges.list', () => ({ changes: [] }));

    await prefetchStartupQueries();

    expect(fakeApi.methods().sort()).toEqual(['pendingChanges.list', 'settings.get', 'system.cmVersion', 'workspaces.info']);
    expect(fakeApi.argsOf('pendingChanges.list')).toEqual([['/wk', DEFAULT_SETTINGS.pendingChanges]]);
  });
});
