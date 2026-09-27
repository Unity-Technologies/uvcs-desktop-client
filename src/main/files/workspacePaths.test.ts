import { describe, expect, it } from 'vitest';
import { toAbsolutePath, withForwardSlashes } from './workspacePaths';

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
