import { describe, expect, it } from 'vitest';
import { judgeToolResult, toolFileNames } from './toolResult';

const run = { exitCode: 0, errorOutput: '' };
const bytes = (text: string): Buffer => Buffer.from(text);

describe('toolFileNames', () => {
  it('names each version after the file, keeping its extension for syntax', () => {
    expect(toolFileNames('src/app/main.ts')).toEqual({ base: 'main.BASE.ts', yours: 'main.YOURS.ts', incoming: 'main.INCOMING.ts', result: 'main.ts' });
    expect(toolFileNames('Makefile').base).toBe('Makefile.BASE');
    expect(toolFileNames('a/we"ird&name.txt').result).toBe('we_ird_name.txt');
  });
});

describe('judgeToolResult', () => {
  const text = { start: bytes('<<<<<<< a\n=======\n>>>>>>> b\n'), yours: bytes('a\n'), incoming: bytes('b\n') };

  it('takes the saved text, whatever the exit code says', () => {
    expect(judgeToolResult({ ...text, result: bytes('a\nb\n') }, { exitCode: null, errorOutput: '' })).toEqual({ kind: 'resolved', text: 'a\nb\n' });
  });

  it('sees nothing resolved when the result is as it started, or gone', () => {
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 1, errorOutput: 'closed' })).toEqual({ kind: 'unchanged', exitCode: 1, errorOutput: 'closed' });
    expect(judgeToolResult({ ...text, result: null }, run)).toMatchObject({ kind: 'unchanged' });
  });

  it('turns a binary result into the version it is', () => {
    const binary = { start: null, yours: bytes('Y'), incoming: bytes('I') };
    expect(judgeToolResult({ ...binary, result: bytes('I') }, run)).toEqual({ kind: 'keptSide', side: 'source' });
    expect(judgeToolResult({ ...binary, result: bytes('Y') }, run)).toEqual({ kind: 'keptSide', side: 'destination' });
    expect(judgeToolResult({ ...binary, result: null }, { exitCode: 1, errorOutput: '' })).toMatchObject({ kind: 'unchanged' });
    expect(judgeToolResult({ ...binary, result: bytes('X') }, run)).toMatchObject({ kind: 'failed' });
  });
});
