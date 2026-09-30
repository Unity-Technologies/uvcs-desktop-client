import { describe, expect, it } from 'vitest';
import { isShellResultLine, resultLineAtEnd, shellCommandResult } from './shellResultLine';

describe('resultLineAtEnd', () => {
  it('finds the result line ending the output, and where the output before it ends', () => {
    expect(resultLineAtEnd('hello\nCommandResult 0\n')).toEqual({ outputEnd: 5, exitCode: 0 });
    expect(resultLineAtEnd('CommandResult -1\r\n')).toEqual({ outputEnd: 0, exitCode: -1 });
  });

  it('ignores result lines with output after them, and text that only ends like one', () => {
    expect(resultLineAtEnd('CommandResult 0\nmore')).toBeNull();
    expect(resultLineAtEnd('hello\nCommandResult 0')).toBeNull();
    expect(resultLineAtEnd('see CommandResult 0\n')).toBeNull();
    expect(resultLineAtEnd('hello\nCommandResult zero\n')).toBeNull();
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
});

describe('isShellResultLine', () => {
  it('tells the result line from output that only mentions one', () => {
    expect(isShellResultLine('CommandResult 0')).toBe(true);
    expect(isShellResultLine('Comment: CommandResult 0')).toBe(false);
  });
});
