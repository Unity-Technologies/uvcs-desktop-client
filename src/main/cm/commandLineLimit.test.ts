import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';
import { fitsCommandLine, isShellResultLine, MAX_COMMAND_LINE, processCommand, quotedLength, shellCommandResult } from './commandLineLimit';

const manyPaths = Array.from({ length: 20_000 }, (_, index) => `/Users/ana/work/My Project/Assets/Textures/Level ${index % 40}/texture_${index}.png`);

describe('processCommand', () => {
  it('starts a command that fits as is', () => {
    expect(processCommand(['status', '--xml'])).toEqual({ args: ['status', '--xml'] });
  });

  it('never starts a process with more than the limit: 20,000 paths go to a cm shell of its own, as one command line', () => {
    const args = checkinArgs(manyPaths, '/tmp/comment.txt');
    const { args: started, input } = processCommand(args);
    expect(started).toEqual(['shell', '--encoding=utf-8']);
    expect(fitsCommandLine(started)).toBe(true);
    const [line, exit] = input!.split('\n');
    expect(exit).toBe('exit');
    expect(line!.startsWith('checkin "/Users/ana/work/My Project/Assets/Textures/Level 0/texture_0.png" ')).toBe(true);
    expect(line!.endsWith(' --all --private -commentsfile=/tmp/comment.txt --machinereadable --symlink')).toBe(true);
    expect(line!.split('texture_').length - 1).toBe(20_000);
  });

  it('on Windows, runs commands that print text in a cm shell of its own, the only way cm prints them in UTF-8', () => {
    const update = ['update', '--forcedetailedprogress', '--dontmerge'];
    expect(processCommand(update, 'win32')).toEqual({ args: ['shell', '--encoding=utf-8'], input: 'update --forcedetailedprogress --dontmerge\nexit\n' });
    expect(processCommand(['diff', 'cs:4', '--format={path}'], 'win32').input).toBe('diff cs:4 --format={path}\nexit\n');
    expect(processCommand(update, 'linux')).toEqual({ args: update });
    expect(processCommand(update, 'darwin')).toEqual({ args: update });
  });

  it('on Windows too, starts commands whose output is UTF-8 anyway, and paths a shell line cannot hold', () => {
    for (const args of [['status', '--xml'], ['find', 'branch', '--format={name}', '--encoding=utf-8'], ['cat', 'revid:3', '--file=C:\\t\\a']]) {
      expect(processCommand(args, 'win32')).toEqual({ args });
    }
    expect(processCommand(['annotate', 'C:\\wk\\say "hi".txt'], 'win32')).toEqual({ args: ['annotate', 'C:\\wk\\say "hi".txt'] });
  });

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

describe('shellCommandResult', () => {
  it("takes the command's code from the shell's last line and leaves the line out", () => {
    expect(shellCommandResult('STAGE\nCHANGESET cs:4@br:/main@repo@local\nCommandResult 0\n')).toEqual({
      output: 'STAGE\nCHANGESET cs:4@br:/main@repo@local\n',
      exitCode: 0,
    });
    expect(shellCommandResult('Error: There are no changes\r\nCommandResult 1\r\n')).toEqual({ output: 'Error: There are no changes\n', exitCode: 1 });
  });

  it('fails when the shell never got to the end of the command', () => {
    expect(shellCommandResult('STAGE\n').exitCode).toBe(-1);
  });

  it('tells the result line from output that only mentions one', () => {
    expect(isShellResultLine('CommandResult 0')).toBe(true);
    expect(isShellResultLine('Comment: CommandResult 0')).toBe(false);
  });
});
