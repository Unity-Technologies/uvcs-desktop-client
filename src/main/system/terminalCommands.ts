export interface TerminalCommand {
  command: string;
  args: string[];
  /** Launchers like `open` exit at once, failing when the app is missing; terminals themselves keep running. */
  exits: boolean;
}

/** macOS terminals by the `$TERM_PROGRAM` they set, when the app was started from one of them. */
const MAC_TERMINAL_APPS: Record<string, string> = {
  'iTerm.app': 'iTerm',
  WezTerm: 'WezTerm',
  ghostty: 'Ghostty',
};

/**
 * Linux terminals, each told the folder its own way (they are started in it too): the desktop's own first (Konsole on
 * KDE; GNOME's Console, Ptyxis and Terminal elsewhere), then the others, and xterm last.
 */
const LINUX_TERMINALS: { command: string; folderArgs: (path: string) => string[]; desktop?: string }[] = [
  { command: 'konsole', folderArgs: (path) => ['--workdir', path], desktop: 'KDE' },
  { command: 'gnome-terminal', folderArgs: (path) => [`--working-directory=${path}`] },
  { command: 'ptyxis', folderArgs: (path) => ['--new-window', `--working-directory=${path}`] },
  { command: 'kgx', folderArgs: (path) => [`--working-directory=${path}`] },
  { command: 'konsole', folderArgs: (path) => ['--workdir', path] },
  { command: 'xfce4-terminal', folderArgs: (path) => [`--working-directory=${path}`] },
  { command: 'xterm', folderArgs: () => [] },
];

/**
 * How to open a terminal in `path`, the preferred way first and the fallbacks after it. Every command also starts in
 * `path`, so none needs it quoted on a command line: Windows Terminal takes `.` (a folder named `a;b` would split its
 * command line), and PowerShell or cmd get a console window of their own.
 */
export function terminalCommands(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, path: string): TerminalCommand[] {
  if (platform === 'darwin') {
    const preferred = MAC_TERMINAL_APPS[env.TERM_PROGRAM ?? ''];
    return [...(preferred ? [preferred] : []), 'Terminal'].map((app) => ({ command: 'open', args: ['-a', app, path], exits: true }));
  }
  if (platform === 'win32') {
    return [
      { command: 'wt.exe', args: ['-d', '.'], exits: false },
      { command: 'pwsh.exe', args: ['-NoLogo'], exits: false },
      { command: 'powershell.exe', args: ['-NoLogo'], exits: false },
      { command: 'cmd.exe', args: [], exits: false },
    ];
  }
  const desktops = (env.XDG_CURRENT_DESKTOP ?? '').split(':');
  const terminals = LINUX_TERMINALS.filter((terminal) => !terminal.desktop || desktops.includes(terminal.desktop)).filter(
    (terminal, index, all) => all.findIndex((other) => other.command === terminal.command) === index,
  );
  return [
    // Debian and Ubuntu's choice of terminal (`update-alternatives`).
    { command: 'x-terminal-emulator', args: [], exits: false },
    ...terminals.map(({ command, folderArgs }) => ({ command, args: folderArgs(path), exits: false })),
  ];
}
