import { describe, expect, it } from 'vitest';
import { toAbsolutePath, withForwardSlashes, workspaceFileOf } from './workspacePaths';

describe('toAbsolutePath', () => {
  it('joins with the separators of the OS the workspace is on', () => {
    expect(toAbsolutePath('/Users/me/wk', 'src/app.ts', 'darwin')).toBe('/Users/me/wk/src/app.ts');
    expect(toAbsolutePath('C:\\Work\\Game', 'Assets/Scripts/a.cs', 'win32')).toBe('C:\\Work\\Game\\Assets\\Scripts\\a.cs');
    expect(toAbsolutePath('C:\\', 'a.cs', 'win32')).toBe('C:\\a.cs');
    expect(toAbsolutePath('\\\\server\\share\\wk', 'a.cs', 'win32')).toBe('\\\\server\\share\\wk\\a.cs');
  });
});

describe('withForwardSlashes', () => {
  it("turns Windows separators into the app's, and leaves a backslash that is part of a name elsewhere", () => {
    expect(withForwardSlashes('Assets\\Scripts\\a.cs', 'win32')).toBe('Assets/Scripts/a.cs');
    expect(withForwardSlashes('odd\\name.txt', 'linux')).toBe('odd\\name.txt');
  });
});

describe('workspaceFileOf', () => {
  it('is the absolute path of a file in the workspace', () => {
    expect(workspaceFileOf('/work/game', 'Assets/Hero.fbx.meta', 'linux')).toBe('/work/game/Assets/Hero.fbx.meta');
    expect(workspaceFileOf('C:\\work\\game', 'Assets/Hero.fbx', 'win32')).toBe('C:\\work\\game\\Assets\\Hero.fbx');
  });

  it('refuses a path that leads out of the workspace, as the renderer is not trusted', () => {
    expect(() => workspaceFileOf('/work/game', '../secrets/key.pem', 'linux')).toThrow('outside the workspace');
    expect(() => workspaceFileOf('/work/game', 'Assets/../../game2/x', 'linux')).toThrow('outside the workspace');
    expect(() => workspaceFileOf('C:\\work\\game', '..\\..\\Windows\\win.ini', 'win32')).toThrow('outside the workspace');
    expect(() => workspaceFileOf('/work/game', '/etc/passwd', 'linux')).toThrow('outside the workspace');
  });
});
