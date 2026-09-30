import { describe, expect, it } from 'vitest';
import { fitsCommandLine, MAX_COMMAND_LINE, quotedLength } from './commandLineLimit';

describe('fitsCommandLine', () => {
  it('measures the whole command line', () => {
    expect(fitsCommandLine(['a'.repeat(MAX_COMMAND_LINE - 1)])).toBe(true);
    expect(fitsCommandLine(['a'.repeat(MAX_COMMAND_LINE / 2), 'b'.repeat(MAX_COMMAND_LINE / 2)])).toBe(false);
  });

  it('counts the quotes Windows needs around paths with spaces', () => {
    const paths = Array.from({ length: 610 }, (_, index) => `C:\\Users\\ana\\My Project\\Assets\\Level ${index % 10}\\t_${String(index).padStart(3, '0')}.png`);
    const unquoted = paths.reduce((length, path) => length + path.length + 1, 0);
    expect(unquoted).toBeLessThan(MAX_COMMAND_LINE);
    expect(fitsCommandLine(paths)).toBe(false);
  });
});

describe('quotedLength', () => {
  it('quotes as Node does on Windows: only with spaces, tabs or quotes, escaping quotes and the backslashes before them', () => {
    expect(quotedLength('C:\\wk\\a.cs')).toBe(10);
    expect(quotedLength('')).toBe(2);
    expect(quotedLength('C:\\My Project\\a.cs')).toBe('"C:\\My Project\\a.cs"'.length);
    expect(quotedLength('C:\\My Project\\')).toBe('"C:\\My Project\\\\"'.length);
    expect(quotedLength('say "hi"')).toBe('"say \\"hi\\""'.length);
    expect(quotedLength('a\\"b')).toBe('"a\\\\\\"b"'.length);
  });
});
