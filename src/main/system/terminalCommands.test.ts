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

  it("uses the user's default terminal on Linux first, then the desktop's own", () => {
    const commands = (desktop?: string) => terminalCommands('linux', { XDG_CURRENT_DESKTOP: desktop }, '/wk/game').map(({ command }) => command);
    expect(commands('ubuntu:GNOME').slice(0, 5)).toEqual(['x-terminal-emulator', 'xdg-terminal-exec', 'gnome-terminal', 'ptyxis', 'kgx']);
    expect(commands('KDE').slice(0, 3)).toEqual(['x-terminal-emulator', 'xdg-terminal-exec', 'konsole']);
    expect(commands('XFCE')[2]).toBe('xfce4-terminal');
    expect(commands()).toEqual(['x-terminal-emulator', 'xdg-terminal-exec', 'gnome-terminal', 'ptyxis', 'kgx', 'konsole', 'xfce4-terminal', 'mate-terminal', 'xterm']);
  });

  it('tells each Linux terminal the folder, where the working directory may not be used', () => {
    const args = Object.fromEntries(terminalCommands('linux', {}, '/wk/my game').map(({ command, args }) => [command, args]));
    expect(args['x-terminal-emulator']).toEqual([]);
    expect(args['gnome-terminal']).toEqual(['--working-directory=/wk/my game']);
    expect(args['konsole']).toEqual(['--workdir', '/wk/my game']);
    expect(args['ptyxis']).toEqual(['--new-window', '--working-directory=/wk/my game']);
  });
});
