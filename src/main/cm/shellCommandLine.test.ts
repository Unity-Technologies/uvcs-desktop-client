import { describe, expect, it } from 'vitest';
import { canRunInShell, toShellCommandLine } from './shellCommandLine';

describe('canRunInShell', () => {
  it.each([
    ['a plain path', ['undo', '/wk/a.cs']],
    ['a path with spaces', ['undo', '/wk/my file.cs']],
    ['a backslash and an apostrophe', ['undo', `/wk/it\\'s.cs`]],
  ])('runs %s in a shell', (_kind, args) => {
    expect(canRunInShell(args)).toBe(true);
  });

  // A `cm shell` splits its line on spaces and quotes only, then trims each argument and drops an empty one.
  it.each([
    ['a double quote', ['undo', '/wk/a"b.cs']],
    ['a line break', ['undo', '/wk/a\nb.cs']],
    ['a carriage return', ['undo', '/wk/a\rb.cs']],
    ['a leading space', ['undo', ' a.cs', '/wk/b.cs']],
    ['a trailing space', ['undo', 'a.cs ', '/wk/b.cs']],
    ['an empty argument', ['find', 'branch', '', '--nototal']],
  ])('keeps %s out of a shell, which would read it differently', (_kind, args) => {
    expect(canRunInShell(args)).toBe(false);
  });
});

describe('toShellCommandLine', () => {
  it('quotes the arguments that hold spaces', () => {
    expect(toShellCommandLine(['checkin', '/wk/my file.cs', '-commentsfile=/t/c.txt'])).toBe(
      'checkin "/wk/my file.cs" -commentsfile=/t/c.txt',
    );
  });
});
