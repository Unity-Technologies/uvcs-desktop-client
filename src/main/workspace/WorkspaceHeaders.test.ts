import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceStatus } from '../cm/workspaceStatus';
import { WorkspaceHeaders, type HeaderReaders } from './WorkspaceHeaders';

const STATUS: WorkspaceStatus = { repositoryName: 'repo', server: 'local', selector: { kind: 'branch', name: '/main' }, loadedChangeset: 3 };

function setUp() {
  let now = 0;
  const readers = {
    status: vi.fn<HeaderReaders['status']>(async () => STATUS),
    names: vi.fn<HeaderReaders['names']>(async () => ({ name: 'wk', guid: 'g-1' })),
  };
  const headers = new WorkspaceHeaders(readers, () => now);
  return { headers, readers, advance: (ms: number) => void (now += ms) };
}

describe('WorkspaceHeaders', () => {
  it('answers the reads that follow one another with one cm status and one getworkspacefrompath', async () => {
    const { headers, readers, advance } = setUp();
    await Promise.all([headers.status('/wk'), headers.names('/wk')]);
    advance(1000);
    await expect(headers.status('/wk')).resolves.toEqual(STATUS);
    await expect(headers.names('/wk')).resolves.toEqual({ name: 'wk', guid: 'g-1' });
    expect(readers.status).toHaveBeenCalledOnce();
    expect(readers.names).toHaveBeenCalledOnce();
  });

  it('reads again once the workspace was rewritten, or the read is a few seconds old', async () => {
    const { headers, readers, advance } = setUp();
    await headers.status('/wk');
    headers.forget('/wk');
    await headers.status('/wk');
    headers.forget();
    await headers.status('/wk');
    advance(5000);
    await headers.status('/wk');
    expect(readers.status).toHaveBeenCalledTimes(4);
  });

  it('keeps workspaces apart and never shares a failure', async () => {
    const { headers, readers } = setUp();
    readers.status.mockRejectedValueOnce(new Error('cm failed'));
    await expect(headers.status('/a')).rejects.toThrow('cm failed');
    await expect(headers.status('/a')).resolves.toEqual(STATUS);
    await headers.status('/b');
    headers.forget('/b');
    await headers.status('/a');
    expect(readers.status.mock.calls.map(([path]) => path)).toEqual(['/a', '/a', '/b']);
  });
});
