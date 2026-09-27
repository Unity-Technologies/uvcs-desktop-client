/** Commands whose `--encoding` sets how their `--xml` output is encoded; `find`'s sets its `--format` output's too. */
const XML_ENCODING_COMMANDS = new Set(['status', 'find', 'ls', 'fileinfo', 'history']);

/**
 * The command, asking for UTF-8 output where `cm` lets it be asked for: otherwise `cm` prints in the console's code
 * page on Windows (437, 850...), and names, paths and comments with accents or in other scripts come out garbled.
 * Elsewhere UTF-8 is what it prints anyway.
 */
export function withUtf8Output(args: string[]): string[] {
  const [command = ''] = args;
  const encodable = XML_ENCODING_COMMANDS.has(command) && (command === 'find' || args.includes('--xml'));
  if (!encodable || args.some((arg) => arg.startsWith('--encoding'))) return args;
  return [...args, '--encoding=utf-8'];
}

/**
 * Whether a process of `cm <args>` prints names, paths or comments as text in the console's code page on Windows,
 * where only a `cm shell` prints them in UTF-8: `--xml` output is UTF-8 anyway, `find`'s follows `--encoding`, and
 * `cm cat` writes its file as it is.
 */
export function printsInConsoleCodePage(args: readonly string[]): boolean {
  const [command = ''] = args;
  return command !== 'cat' && !args.includes('--xml') && !args.some((arg) => arg.startsWith('--encoding'));
}
