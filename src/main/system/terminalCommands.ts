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
  return [
    { command: 'x-terminal-emulator', args: [], exits: false },
    { command: 'gnome-terminal', args: [`--working-directory=${path}`], exits: false },
    { command: 'xterm', args: [], exits: false },
  ];
}
