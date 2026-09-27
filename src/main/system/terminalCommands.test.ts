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

  it('tries Windows Terminal, then PowerShell, then cmd, all started in the folder rather than told it', () => {
    const commands = terminalCommands('win32', {}, 'C:\\wk\\R&D;game');
    expect(commands.map(({ command }) => command)).toEqual(['wt.exe', 'pwsh.exe', 'powershell.exe', 'cmd.exe']);
    expect(commands[0]!.args).toEqual(['-d', '.']);
    expect(commands.flatMap(({ args }) => args).join(' ')).not.toContain('R&D');
  });

  it("uses the Debian alternative on Linux first, then the desktop's own terminal, each told the folder its way", () => {
    const gnome = terminalCommands('linux', { XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' }, '/wk/game');
    expect(gnome.map(({ command }) => command)).toEqual(['x-terminal-emulator', 'gnome-terminal', 'ptyxis', 'kgx', 'konsole', 'xfce4-terminal', 'xterm']);
    expect(gnome[1]!.args).toEqual(['--working-directory=/wk/game']);
    const kde = terminalCommands('linux', { XDG_CURRENT_DESKTOP: 'KDE' }, '/wk/game');
    expect(kde.slice(0, 2)).toEqual([
      { command: 'x-terminal-emulator', args: [], exits: false },
      { command: 'konsole', args: ['--workdir', '/wk/game'], exits: false },
    ]);
    expect(kde.filter(({ command }) => command === 'konsole')).toHaveLength(1);
  });
});
