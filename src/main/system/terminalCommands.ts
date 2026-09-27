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
 * Linux terminals, each told the folder to open in, by the desktops that ship them (`$XDG_CURRENT_DESKTOP` names):
 * after the user's own choice, the desktop's terminal comes first, then the others. KDE, Fedora or Arch have no
 * `x-terminal-emulator`, and Ubuntu 25.10 and Fedora use Ptyxis where GNOME Terminal used to be.
 */
const LINUX_TERMINALS: { command: string; args: (path: string) => string[]; desktops: string[] }[] = [
  { command: 'gnome-terminal', args: (path) => [`--working-directory=${path}`], desktops: ['GNOME', 'Unity', 'Budgie'] },
  { command: 'ptyxis', args: (path) => ['--new-window', `--working-directory=${path}`], desktops: ['GNOME'] },
  { command: 'kgx', args: (path) => [`--working-directory=${path}`], desktops: ['GNOME'] },
  { command: 'konsole', args: (path) => ['--workdir', path], desktops: ['KDE'] },
  { command: 'xfce4-terminal', args: (path) => [`--working-directory=${path}`], desktops: ['XFCE'] },
  { command: 'mate-terminal', args: (path) => [`--working-directory=${path}`], desktops: ['MATE'] },
];

/** How to open a terminal in `path`, the preferred way first and the fallbacks after it. */
export function terminalCommands(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, path: string): TerminalCommand[] {
  if (platform === 'darwin') {
    const preferred = MAC_TERMINAL_APPS[env.TERM_PROGRAM ?? ''];
    return [...(preferred ? [preferred] : []), 'Terminal'].map((app) => ({ command: 'open', args: ['-a', app, path], exits: true }));
  }
  if (platform === 'win32') {
    return [
      { command: 'wt.exe', args: ['-d', path], exits: false },
      { command: 'cmd.exe', args: ['/c', 'start', 'cmd.exe', '/k', 'cd', '/d', path], exits: true },
    ];
  }
  // The user's default terminal (Debian's alternative, the freedesktop launcher) opens in the working directory.
  const desktops = (env.XDG_CURRENT_DESKTOP ?? '').split(':');
  const ownFirst = [...LINUX_TERMINALS].sort(
    (a, b) => Number(b.desktops.some((desktop) => desktops.includes(desktop))) - Number(a.desktops.some((desktop) => desktops.includes(desktop))),
  );
  return [
    ...['x-terminal-emulator', 'xdg-terminal-exec'].map((command) => ({ command, args: [], exits: false })),
    ...ownFirst.map(({ command, args }) => ({ command, args: args(path), exits: false })),
    { command: 'xterm', args: [], exits: false },
  ];
}
