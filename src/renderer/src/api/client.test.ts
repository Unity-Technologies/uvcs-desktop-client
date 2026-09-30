import { beforeEach, describe, expect, it, vi } from 'vitest';

const uvcs = await vi.hoisted(async () => (await import('../lib/testing/fakeWindow')).installFakeWindow());

import { api, ApiError } from './client';

beforeEach(() => uvcs.reset());

describe('api', () => {
  it('sends api.<area>.<method>(...args) to main as one invoke named "<area>.<method>"', async () => {
    await api.branches.list('/ws', { limit: 5 });

    expect(uvcs.calls).toEqual([{ method: 'branches.list', args: ['/ws', { limit: 5 }] }]);
  });

  it('resolves with the value main answered', async () => {
    uvcs.answer = () => ({ ok: true, value: [{ id: 7 }] });

    await expect(api.labels.list('/ws', {})).resolves.toEqual([{ id: 7 }]);
  });

  it('turns a remote error into an ApiError that keeps the failed command for the command log', async () => {
    const command = { commandLine: 'cm switch br:/main', exitCode: 1, output: 'boom', logEntryId: 42 };
    uvcs.answer = () => ({ ok: false, error: { message: 'The branch does not exist', command } });

    const failure = await api.workspaces.list().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: 'The branch does not exist', command });
  });

  it('can be awaited as an area without being mistaken for a promise', async () => {
    const area = await Promise.resolve(api.branches);

    expect(typeof area.list).toBe('function');
    expect(uvcs.calls).toEqual([]);
  });
});
