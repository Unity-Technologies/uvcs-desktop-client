import { describe, expect, it } from 'vitest';
import { NO_INSTALLED_APPS, type InstalledApps } from './installedApps';
import { automaticTerminal, KNOWN_TERMINALS } from './terminals';
import { fakeFileSystem, installedOnMac, installedOnWindows, linux, mac, windows } from './testing/appFixtures';
import type { AppFileSystem } from './appFileSystem';
import type { Whereabouts } from './whereabouts';

/** Each terminal found, with how it opens `folder`. */
function found(where: Whereabouts, installed: InstalledApps, fs: AppFileSystem, folder: string) {
  return KNOWN_TERMINALS.filter((terminal) => terminal.platform === where.platform).flatMap((terminal) => {
    const terminalFound = terminal.find(where, installed, fs);
    return terminalFound ? [{ id: terminal.id, location: terminalFound.location, launch: terminalFound.launch(folder) }] : [];
  });
}

describe('terminals on macOS', () => {
  it('finds terminals by bundle identifier wherever they are, and opens most with `open -a`', () => {
    const installed = installedOnMac({ 'com.apple.Terminal': '/System/Applications/Utilities/Terminal.app', 'com.googlecode.iterm2': '/Users/me/Apps/iTerm.app' });
    expect(found(mac, installed, fakeFileSystem([]), '/wk/game')).toEqual([
      { id: 'terminal', location: '/System/Applications/Utilities/Terminal.app', launch: { command: 'open', args: ['-a', '/System/Applications/Utilities/Terminal.app', '/wk/game'], exits: true } },
      { id: 'iterm', location: '/Users/me/Apps/iTerm.app', launch: { command: 'open', args: ['-a', '/Users/me/Apps/iTerm.app', '/wk/game'], exits: true } },
    ]);
  });

  it('finds them in the Applications folders when Spotlight has no answer', () => {
    expect(found(mac, NO_INSTALLED_APPS, fakeFileSystem(['/System/Applications/Utilities/Terminal.app', '/Applications/Ghostty.app']), '/wk').map(({ id }) => id)).toEqual(['terminal', 'ghostty']);
  });

  it('runs the program in the bundle of terminals that take the folder as an argument', () => {
    const installed = installedOnMac({ 'net.kovidgoyal.kitty': '/Applications/kitty.app', 'com.github.wez.wezterm': '/Applications/WezTerm.app' });
    const fs = fakeFileSystem(['/Applications/kitty.app/Contents/MacOS/kitty', '/Applications/WezTerm.app/Contents/MacOS/wezterm']);
    expect(found(mac, installed, fs, '/wk/my game').map(({ launch }) => launch)).toEqual([
      { command: '/Applications/WezTerm.app/Contents/MacOS/wezterm', args: ['start', '--cwd', '/wk/my game'], cwd: '/wk/my game', exits: false },
      { command: '/Applications/kitty.app/Contents/MacOS/kitty', args: ['--single-instance', '--directory', '/wk/my game'], cwd: '/wk/my game', exits: false },
    ]);
  });
});

describe('terminals on Windows', () => {
  it("always offers Windows' own consoles, started in a console of their own and in the folder rather than told it", () => {
    const terminals = found(windows, NO_INSTALLED_APPS, fakeFileSystem([]), 'C:\\wk\\R&D;game');
    expect(terminals.map(({ id, launch }) => [id, launch])).toEqual([
      ['windowsPowerShell', { command: 'cmd.exe', args: ['/d', '/c', 'start', 'powershell.exe', '-NoLogo'], cwd: 'C:\\wk\\R&D;game', exits: true }],
      ['commandPrompt', { command: 'cmd.exe', args: ['/d', '/c', 'start', 'cmd.exe'], cwd: 'C:\\wk\\R&D;game', exits: true }],
    ]);
    expect(terminals.flatMap(({ launch }) => launch.args).join(' ')).not.toContain('R&D');
  });

  it('finds Windows Terminal by its alias, PowerShell 7 by its registered path and Git Bash by its uninstall entry', () => {
    const installed = installedOnWindows(
      [{ displayName: 'Git', publisher: 'The Git Development Community', installLocation: 'C:\\Program Files\\Git\\' }],
      { 'pwsh.exe': 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
    );
    const fs = fakeFileSystem(['C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe', 'C:\\Program Files\\Git\\git-bash.exe']);
    const terminals = found(windows, installed, fs, 'C:\\wk\\game');
    expect(terminals.map(({ id }) => id)).toEqual(['windowsTerminal', 'pwsh', 'windowsPowerShell', 'commandPrompt', 'gitBash']);
    expect(terminals[0]!.launch).toEqual({ command: 'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe', args: ['-d', '.'], cwd: 'C:\\wk\\game', exits: false });
    expect(terminals[1]!.launch).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', '"start "" "C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo"'],
      cwd: 'C:\\wk\\game',
      exits: true,
      verbatim: true,
    });
    expect(terminals[4]!.launch).toEqual({ command: 'C:\\Program Files\\Git\\git-bash.exe', args: ['--cd=C:\\wk\\game'], cwd: 'C:\\wk\\game', exits: false });
  });
});

describe('terminals on Linux', () => {
  it('finds terminals on the PATH, each told the folder its own way', () => {
    const fs = fakeFileSystem(['/usr/bin/x-terminal-emulator', '/usr/bin/konsole', '/usr/bin/gnome-terminal', '/usr/bin/kitty']);
    expect(found(linux, NO_INSTALLED_APPS, fs, '/wk/game').map(({ id, launch }) => [id, launch.args])).toEqual([
      ['xTerminalEmulator', []],
      ['konsole', ['--workdir', '/wk/game']],
      ['gnomeTerminal', ['--working-directory=/wk/game']],
      ['kittyLinux', ['--single-instance', '--directory', '/wk/game']],
    ]);
  });
});

describe('automaticTerminal', () => {
  it('on macOS, the terminal the app was started from, else Terminal', () => {
    expect(automaticTerminal(['terminal', 'iterm'], 'darwin', { TERM_PROGRAM: 'iTerm.app' })).toBe('iterm');
    expect(automaticTerminal(['terminal', 'iterm'], 'darwin', { TERM_PROGRAM: 'vscode' })).toBe('terminal');
    expect(automaticTerminal(['terminal'], 'darwin', { TERM_PROGRAM: 'iTerm.app' })).toBe('terminal');
  });

  it('on Windows, Windows Terminal, else Windows PowerShell', () => {
    expect(automaticTerminal(['windowsTerminal', 'pwsh', 'windowsPowerShell', 'commandPrompt'], 'win32', {})).toBe('windowsTerminal');
    expect(automaticTerminal(['pwsh', 'windowsPowerShell', 'commandPrompt'], 'win32', {})).toBe('windowsPowerShell');
  });

  it("on Linux, the system's choice, else the desktop's own terminal, else the first found", () => {
    expect(automaticTerminal(['xTerminalEmulator', 'konsole'], 'linux', { XDG_CURRENT_DESKTOP: 'KDE' })).toBe('xTerminalEmulator');
    expect(automaticTerminal(['gnomeTerminal', 'konsole'], 'linux', { XDG_CURRENT_DESKTOP: 'KDE' })).toBe('konsole');
    expect(automaticTerminal(['konsole', 'gnomeTerminal', 'ptyxis'], 'linux', { XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' })).toBe('ptyxis');
    expect(automaticTerminal(['xterm'], 'linux', {})).toBe('xterm');
    expect(automaticTerminal([], 'linux', {})).toBeNull();
  });
});
