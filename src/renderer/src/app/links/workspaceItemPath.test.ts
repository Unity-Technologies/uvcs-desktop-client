import { describe, expect, it } from 'vitest';
import { workspaceItemPath } from './workspaceItemPath';

describe('workspaceItemPath', () => {
  it("finds an item inside the workspace, '' for its root", () => {
    expect(workspaceItemPath('/Users/ana/wk/game', '/Users/ana/wk/game/Assets/Player.cs', 'darwin')).toBe('Assets/Player.cs');
    expect(workspaceItemPath('/Users/ana/wk/game', '/Users/ana/wk/game/', 'linux')).toBe('');
  });

  it('reads a Windows root as cm names it against a folder a link wrote with forward slashes, in any case', () => {
    expect(workspaceItemPath('C:\\Users\\ana\\wk\\Game', 'c:/users/ana/wk/game/Assets/Player.cs', 'win32')).toBe('Assets/Player.cs');
  });

  it('compares names exactly on Linux, and finds nothing outside the workspace or in a folder only starting like it', () => {
    expect(workspaceItemPath('/home/ana/wk/Game', '/home/ana/wk/game/a.cs', 'linux')).toBeNull();
    expect(workspaceItemPath('/wk/game', '/wk/game-art/a.cs', 'darwin')).toBeNull();
    expect(workspaceItemPath('/wk/game', '/elsewhere/a.cs', 'darwin')).toBeNull();
  });
});
