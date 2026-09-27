import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';
import { fitsCommandLine, isShellResultLine, MAX_COMMAND_LINE, processCommand, shellCommandResult } from './commandLineLimit';

const manyPaths = Array.from({ length: 20_000 }, (_, index) => `/Users/ana/work/My Project/Assets/Textures/Level ${index % 40}/texture_${index}.png`);

describe('processCommand', () => {
  it('starts a command that fits as is', () => {
    expect(processCommand(['status', '--xml'])).toEqual({ args: ['status', '--xml'] });
  });

  it('never starts a process with more than the limit: 20,000 paths go to a cm shell of its own, as one command line', () => {
    const args = checkinArgs(manyPaths, '/tmp/comment.txt');
    const { args: started, input } = processCommand(args);
    expect(started).toEqual(['shell']);
    expect(fitsCommandLine(started)).toBe(true);
    const [line, exit] = input!.split('\n');
    expect(exit).toBe('exit');
    expect(line!.startsWith('checkin "/Users/ana/work/My Project/Assets/Textures/Level 0/texture_0.png" ')).toBe(true);
    expect(line!.endsWith(' --all --private -commentsfile=/tmp/comment.txt --machinereadable --symlink')).toBe(true);
    expect(line!.split('texture_').length - 1).toBe(20_000);
  });

  it('measures the whole command line', () => {
    expect(fitsCommandLine(['a'.repeat(MAX_COMMAND_LINE - 1)])).toBe(true);
    expect(fitsCommandLine(['a'.repeat(MAX_COMMAND_LINE / 2), 'b'.repeat(MAX_COMMAND_LINE / 2)])).toBe(false);
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
