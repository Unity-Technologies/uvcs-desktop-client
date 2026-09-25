import { describe, expect, it } from 'vitest';
import { terminalCommands } from './terminalCommands';

describe('terminalCommands', () => {
  it('opens Terminal on macOS', () => {
    expect(terminalCommands('darwin', {}, '/wk/game')).toEqual([{ command: 'open', args: ['-a', 'Terminal', '/wk/game'], exits: true }]);
  });

  it('prefers the terminal the app was started from, falling back to Terminal', () => {
    expect(terminalCommands('darwin', { TERM_PROGRAM: 'iTerm.app' }, '/wk/game').map(({ args }) => args[1])).toEqual(['iTerm', 'Terminal']);
    expect(terminalCommands('darwin', { TERM_PROGRAM: 'vscode' }, '/wk/game').map(({ args }) => args[1])).toEqual(['Terminal']);
  });

  it('tries Windows Terminal, then cmd', () => {
    expect(terminalCommands('win32', {}, 'C:\\wk\\game').map(({ command }) => command)).toEqual(['wt.exe', 'cmd.exe']);
    expect(terminalCommands('win32', {}, 'C:\\wk\\game')[0]!.args).toEqual(['-d', 'C:\\wk\\game']);
  });

  it('uses the Debian alternative on Linux first', () => {
    expect(terminalCommands('linux', {}, '/wk/game')[0]!.command).toBe('x-terminal-emulator');
  });
});
