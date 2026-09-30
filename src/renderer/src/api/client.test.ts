import { FakeCommandFailure, fakeApi } from '../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { api, ApiError } from './client';

describe('api', () => {
  it('sends api.<area>.<method>(...args) to main as one invoke named "<area>.<method>"', async () => {
    fakeApi.answer('branches.list', () => []);

    await api.branches.list('/ws', { limit: 5 });

    expect(fakeApi.calls()).toEqual([{ method: 'branches.list', args: ['/ws', { limit: 5 }] }]);
  });

  it('resolves with the value main answered', async () => {
    fakeApi.answer('labels.list', () => [{ id: 7 }]);

    await expect(api.labels.list('/ws', {})).resolves.toEqual([{ id: 7 }]);
  });

  it('turns a remote error into an ApiError that keeps the failed command for the command log', async () => {
    const command = { commandLine: 'cm switch br:/main', exitCode: 1, output: 'The branch does not exist', logEntryId: 42 };
    fakeApi.answer('workspaces.list', () => {
      throw new FakeCommandFailure(command);
    });

    const failure = await api.workspaces.list().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: 'The branch does not exist', command });
  });

  it('can be awaited as an area without being mistaken for a promise', async () => {
    const area = await Promise.resolve(api.branches);

    expect(typeof area.list).toBe('function');
    expect(fakeApi.calls()).toEqual([]);
  });
});
