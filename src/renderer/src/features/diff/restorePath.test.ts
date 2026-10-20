import { describe, expect, it } from 'vitest';
import { restorePathProblem, typedRestorePath } from './restorePath';

describe('typedRestorePath', () => {
  it('takes the path as typed, trimmed', () => {
    expect(typedRestorePath('  src/Old/Enemy.cs ', 'darwin')).toBe('src/Old/Enemy.cs');
  });

  it('takes Windows separators on Windows, where people type them', () => {
    expect(typedRestorePath('src\\Old\\Enemy.cs', 'win32')).toBe('src/Old/Enemy.cs');
  });

  it('leaves a backslash elsewhere, where it can be part of a name', () => {
    expect(typedRestorePath('src\\Enemy.cs', 'linux')).toBe('src\\Enemy.cs');
  });
});

describe('restorePathProblem', () => {
  it('takes a path in the workspace', () => {
    expect(restorePathProblem('src/Enemy-old.cs', 'darwin')).toBeUndefined();
    expect(restorePathProblem('src\\Old\\Enemy.cs', 'win32')).toBeUndefined();
  });

  it('refuses what leads out of it or names nothing', () => {
    expect(restorePathProblem('../Enemy.cs', 'darwin')).toBeDefined();
    expect(restorePathProblem('src//Enemy.cs', 'darwin')).toBeDefined();
    expect(restorePathProblem('src\\Enemy.cs', 'linux')).toBeDefined();
    expect(restorePathProblem('..\\Enemy.cs', 'win32')).toBeDefined();
  });

  it('says a path in the workspace starts with no separator', () => {
    expect(restorePathProblem('/src/Enemy.cs', 'darwin')).toBe('A path in the workspace starts with a folder or a name, not “/”');
    expect(restorePathProblem('\\src\\Enemy.cs', 'win32')).toBe('A path in the workspace starts with a folder or a name, not “\\”');
  });
});
