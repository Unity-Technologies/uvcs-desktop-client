import { fitsCommandLine } from './commandLineLimit';
import { canRunInShell, SHELL_ARGS, toShellCommandLine } from './shellCommandLine';
import { printsInConsoleCodePage } from './utf8Output';

interface ProcessCommand {
  args: string[];
  /** The command line, for a `cm shell` of its own to read. */
  input?: string;
}

/**
 * How to run `cm <args>` in a process of its own: as is, or as a line a `cm shell` reads, when it's too long to start
 * a process with (as long as it takes), or on Windows when it prints text: a process prints it in the console's code
 * page there (437, 850...), garbling accents and turning other scripts into `?`, a shell in UTF-8. It costs the
 * shell's start, about half a second more.
 */
export function processCommand(args: string[], platform: NodeJS.Platform = process.platform): ProcessCommand {
  const asIs = fitsCommandLine(args) && (platform !== 'win32' || !printsInConsoleCodePage(args));
  // A path with a quote or a line break can't be written on a shell's line: it's left to the process as it is.
  if (asIs || !canRunInShell(args)) return { args };
  return { args: [...SHELL_ARGS], input: `${toShellCommandLine(args)}\nexit\n` };
}
