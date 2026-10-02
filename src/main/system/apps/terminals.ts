import { posix, win32 } from 'node:path';
import { APP_IDENTITIES } from './appIdentities';
import { locateInstall, programInInstall, type AppIdentity } from './appIdentity';
import type { AppFileSystem } from './appFileSystem';
import { findFirst, findOnPath } from './findProgram';
import type { InstalledApps } from './installedApps';
import { macOpen, type LaunchCommand } from './launchCommand';
import { programFiles, type Whereabouts } from './whereabouts';

/** A terminal app, opened in a folder: each one is told the folder its own way. */
export interface KnownTerminal {
  id: string;
  name: string;
  platform: NodeJS.Platform;
  find: (where: Whereabouts, installed: InstalledApps, fs: AppFileSystem) => FoundTerminal | undefined;
}

export interface FoundTerminal {
  location: string;
  launch: (folder: string) => LaunchCommand;
}

/**
 * macOS terminals: most open a folder given to `open -a` (GitHub Desktop runs `open -b`, the same); kitty, Alacritty
 * and WezTerm take it as an argument of their own program in the bundle.
 */
function mac(id: string, name: string, identity: AppIdentity, program?: { path: string; args: (folder: string) => string[] }): KnownTerminal {
  return {
    id,
    name,
    platform: 'darwin',
    find: (where, installed, fs) => {
      const install = locateInstall(identity, where, installed, fs);
      if (install?.kind !== 'macBundle') return undefined;
      if (!program) return { location: install.bundle, launch: (folder) => macOpen(install.bundle, folder) };
      const executable = posix.join(install.bundle, program.path);
      return fs.exists(executable) ? { location: install.bundle, launch: (folder) => ({ command: executable, args: program.args(folder), cwd: folder, exits: false }) } : undefined;
    },
  };
}

/**
 * Windows consoles must be started by cmd's `start`: started by the app, which has no console, they would get none,
 * show nothing and end at once. The path to `start` comes from the registry or Program Files and holds no quotes;
 * `/s` keeps the quotes inside the line.
 */
function windowsConsole(id: string, name: string, locate: (where: Whereabouts, installed: InstalledApps, fs: AppFileSystem) => string | undefined): KnownTerminal {
  return {
    id,
    name,
    platform: 'win32',
    find: (where, installed, fs) => {
      const program = locate(where, installed, fs);
      if (!program) return undefined;
      return { location: program, launch: (folder) => ({ command: 'cmd.exe', args: ['/d', '/s', '/c', `"start "" "${program}" -NoLogo"`], cwd: folder, exits: true, verbatim: true }) };
    },
  };
}

/** Windows' own consoles, always there: started by name, as before any other terminal was looked for. */
function windowsBuiltIn(id: string, name: string, program: string, args: string[]): KnownTerminal {
  return {
    id,
    name,
    platform: 'win32',
    find: (where) => ({
      location: win32.join(where.env.SystemRoot ?? 'C:\\Windows', 'System32', ...(program === 'powershell.exe' ? ['WindowsPowerShell', 'v1.0'] : []), program),
      launch: (folder) => ({ command: 'cmd.exe', args: ['/d', '/c', 'start', program, ...args], cwd: folder, exits: true }),
    }),
  };
}

/** Linux terminals, found on the PATH, each told the folder its own way (and started in it too). */
function linux(id: string, name: string, command: string, folderArgs: (folder: string) => string[]): KnownTerminal {
  return {
    id,
    name,
    platform: 'linux',
    find: (where, _installed, fs) => {
      const program = findOnPath([command], where, fs);
      return program ? { location: program, launch: (folder) => ({ command: program, args: folderArgs(folder), cwd: folder, exits: false }) } : undefined;
    },
  };
}

const workingDirectory = (folder: string): string[] => [`--working-directory=${folder}`];

/** The terminals looked for, by OS, in the order they're listed. */
export const KNOWN_TERMINALS: KnownTerminal[] = [
  mac('terminal', 'Terminal', APP_IDENTITIES.terminal),
  mac('iterm', 'iTerm', APP_IDENTITIES.iterm),
  mac('ghostty', 'Ghostty', APP_IDENTITIES.ghostty),
  mac('warp', 'Warp', APP_IDENTITIES.warp),
  mac('wezterm', 'WezTerm', APP_IDENTITIES.wezterm, { path: 'Contents/MacOS/wezterm', args: (folder) => ['start', '--cwd', folder] }),
  mac('kitty', 'kitty', APP_IDENTITIES.kitty, { path: 'Contents/MacOS/kitty', args: (folder) => ['--single-instance', '--directory', folder] }),
  mac('alacritty', 'Alacritty', APP_IDENTITIES.alacritty, { path: 'Contents/MacOS/alacritty', args: (folder) => ['--working-directory', folder] }),
  mac('hyper', 'Hyper', APP_IDENTITIES.hyper),
  mac('powershell', 'PowerShell', APP_IDENTITIES.powershellMac),

  {
    // `wt.exe` is an app execution alias in WindowsApps; Windows Terminal takes `.` (a folder named `a;b` would split
    // its command line) and starts in the folder.
    id: 'windowsTerminal',
    name: 'Windows Terminal',
    platform: 'win32',
    find: (where, _installed, fs) => {
      const aliases = where.env.LOCALAPPDATA ? [win32.join(where.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'wt.exe')] : [];
      const program = findFirst(aliases, where, fs) ?? findOnPath(['wt.exe'], where, fs);
      return program ? { location: program, launch: (folder) => ({ command: program, args: ['-d', '.'], cwd: folder, exits: false }) } : undefined;
    },
  },
  windowsConsole('pwsh', 'PowerShell 7', (where, installed, fs) => installed.appPaths.get('pwsh.exe') ?? findFirst(programFiles(where, 'PowerShell\\7\\pwsh.exe'), where, fs)),
  windowsBuiltIn('windowsPowerShell', 'Windows PowerShell', 'powershell.exe', ['-NoLogo']),
  windowsBuiltIn('commandPrompt', 'Command Prompt', 'cmd.exe', []),
  {
    id: 'gitBash',
    name: 'Git Bash',
    platform: 'win32',
    find: (where, installed, fs) => {
      const program = programInInstall(APP_IDENTITIES.gitBash, ['git-bash.exe'], where, installed, fs) ?? findFirst(programFiles(where, 'Git\\git-bash.exe'), where, fs);
      return program ? { location: program, launch: (folder) => ({ command: program, args: [`--cd=${folder}`], cwd: folder, exits: false }) } : undefined;
    },
  },

  // Debian and Ubuntu's choice of terminal (`update-alternatives`), started in the folder.
  linux('xTerminalEmulator', 'System terminal', 'x-terminal-emulator', () => []),
  linux('konsole', 'Konsole', 'konsole', (folder) => ['--workdir', folder]),
  linux('gnomeTerminal', 'GNOME Terminal', 'gnome-terminal', workingDirectory),
  linux('ptyxis', 'Ptyxis', 'ptyxis', (folder) => ['--new-window', ...workingDirectory(folder)]),
  linux('gnomeConsole', 'Console', 'kgx', workingDirectory),
  linux('xfceTerminal', 'Xfce Terminal', 'xfce4-terminal', workingDirectory),
  linux('tilix', 'Tilix', 'tilix', workingDirectory),
  linux('ghosttyLinux', 'Ghostty', 'ghostty', workingDirectory),
  linux('kittyLinux', 'kitty', 'kitty', (folder) => ['--single-instance', '--directory', folder]),
  linux('alacrittyLinux', 'Alacritty', 'alacritty', (folder) => ['--working-directory', folder]),
  linux('weztermLinux', 'WezTerm', 'wezterm', (folder) => ['start', '--cwd', folder]),
  linux('xterm', 'XTerm', 'xterm', () => []),
];

/** macOS terminals by the `$TERM_PROGRAM` they set, when the app was started from one of them. */
const MAC_TERM_PROGRAMS: Record<string, string> = { 'iTerm.app': 'iterm', WezTerm: 'wezterm', ghostty: 'ghostty', WarpTerminal: 'warp' };

/** Linux desktops' own terminals, by `$XDG_CURRENT_DESKTOP`. */
const DESKTOP_TERMINALS: Record<string, string[]> = { KDE: ['konsole'], GNOME: ['gnomeConsole', 'ptyxis', 'gnomeTerminal'], XFCE: ['xfceTerminal'] };

/**
 * The terminal "Automatic" opens, of those found: on macOS the one the app was started from, else Terminal; on
 * Windows, Windows Terminal, else Windows PowerShell; on Linux the system's choice, else the desktop's own, else the
 * first found.
 */
export function automaticTerminal(foundIds: string[], platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string | null {
  const preferences =
    platform === 'darwin'
      ? [MAC_TERM_PROGRAMS[env.TERM_PROGRAM ?? ''], 'terminal']
      : platform === 'win32'
        ? ['windowsTerminal', 'windowsPowerShell']
        : ['xTerminalEmulator', ...(env.XDG_CURRENT_DESKTOP ?? '').split(':').flatMap((desktop) => DESKTOP_TERMINALS[desktop] ?? [])];
  return preferences.find((id): id is string => id !== undefined && foundIds.includes(id)) ?? foundIds[0] ?? null;
}
