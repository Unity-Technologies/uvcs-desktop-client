/**
 * Windows runs `.cmd` launchers (VS Code's `code.cmd`, JetBrains Toolbox scripts) only through `cmd.exe`, which reads
 * the whole line: every argument is quoted, which keeps `&`, `^`, `|`, `<` and `>` literal (a user folder named
 * `R&D`), and loses the only characters cmd still reads inside quotes: `"`, and `%` and `!` that could name a
 * variable. Arguments are the app's temp paths (whose names it makes of letters, digits and `_ .-`) and version names.
 * Backslashes ending an argument are doubled, or the program would read the closing quote as a quote in it.
 */
export function spawnCommand(platform: NodeJS.Platform, executable: string, args: string[]): { command: string; commandArgs: string[]; verbatim: boolean } {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(executable)) return { command: executable, commandArgs: args, verbatim: false };
  const quote = (arg: string): string => `"${arg.replace(/["%!]/g, '').replace(/(\\+)$/, '$1$1')}"`;
  return { command: 'cmd.exe', commandArgs: ['/d', '/s', '/c', `"${[executable, ...args].map(quote).join(' ')}"`], verbatim: true };
}
