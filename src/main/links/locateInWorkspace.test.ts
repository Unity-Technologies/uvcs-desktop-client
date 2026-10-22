import { describe, expect, it } from 'vitest';
import { locateInWorkspace } from './locateInWorkspace';

/** A file system where `links` are followed (a link's path → where it leads) and only `existing` paths resolve. */
function fileSystem(links: Record<string, string>, existing: string[]) {
  return async (path: string): Promise<string> => {
    const followed = Object.entries(links).reduce((current, [link, target]) => (current.startsWith(link) ? target + current.slice(link.length) : current), path);
    if (!existing.includes(followed)) throw new Error('ENOENT');
    return followed;
  };
}

describe('locateInWorkspace', () => {
  it("finds an item named through a link to the workspace's folder (macOS's /tmp)", async () => {
    const resolve = fileSystem({ '/tmp': '/private/tmp' }, ['/private/tmp/wk', '/private/tmp/wk/src', '/private/tmp/wk/src/app.ts']);
    const found = await locateInWorkspace('/tmp/wk/src/app.ts', { findRoot: async () => '/private/tmp/wk', resolve, platform: 'darwin' });
    expect(found).toEqual({ root: '/private/tmp/wk', itemPath: 'src/app.ts' });
  });

  it("finds the root itself, and an item that doesn't exist by its folder", async () => {
    const resolve = fileSystem({}, ['/wk', '/wk/src']);
    const findRoot = async () => '/wk';
    expect(await locateInWorkspace('/wk', { findRoot, resolve, platform: 'linux' })).toEqual({ root: '/wk', itemPath: '' });
    expect(await locateInWorkspace('/wk/src/new.ts', { findRoot, resolve, platform: 'linux' })).toEqual({ root: '/wk', itemPath: 'src/new.ts' });
  });

  it('reads a Windows path written with forward slashes, the item named with forward slashes', async () => {
    const found = await locateInWorkspace('C:/Users/ana/wk/Assets/Player.cs', { findRoot: async () => 'C:\\Users\\ana\\wk', resolve: async (path) => path, platform: 'win32' });
    expect(found).toEqual({ root: 'C:\\Users\\ana\\wk', itemPath: 'Assets/Player.cs' });
  });

  it('finds an item at the root whose name starts with two dots', async () => {
    const found = await locateInWorkspace('/wk/..config', { findRoot: async () => '/wk', resolve: async (path) => path, platform: 'linux' });
    expect(found).toEqual({ root: '/wk', itemPath: '..config' });
  });

  it('finds nothing outside any workspace', async () => {
    expect(await locateInWorkspace('/elsewhere/a.ts', { findRoot: async () => null, resolve: async (path) => path, platform: 'linux' })).toBeNull();
  });
});
