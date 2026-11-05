import { fitsCommandLine } from './commandLineLimit';
import { isOperation } from './operationCommands';
import { canRunInShell, SHELL_ARGS, toShellCommandLine } from './shellCommandLine';
import { printsInConsoleCodePage } from './utf8Output';

interface ProcessCommand {
  args: string[];
  /** The command line, for a `cm shell` of its own to read. */
  input?: string;
}

/**
 * How to run `cm <args>` in a process of its own: as is, or as a line a `cm shell` of its own reads, which ends with
 * the command. The shell runs:
 * - Every operation (`isOperation`: a checkin, an undo, an update, a shelve...), on every OS: `cm` counts the commands
 *   a `cm shell` runs as the app's, and only the plain processes a script would start as its own.
 * - A command too long to start a process with, however long it takes.
 * - On Windows, a command that prints text: a process prints it in the console's code page there (437, 850...),
 *   garbling accents and turning other scripts into `?`, a shell in UTF-8.
 * The shell costs its start, about half a second more: quick reads that take a process (a check that can time out, a
 * read before the pooled sessions are warm) start as they are.
 */
export function processCommand(args: string[], platform: NodeJS.Platform = process.platform): ProcessCommand {
  const asIs = fitsCommandLine(args) && !isOperation(args) && (platform !== 'win32' || !printsInConsoleCodePage(args));
  // An argument a shell's line can't carry exactly (`canRunInShell`) is left to the process as it is.
  if (asIs || !canRunInShell(args)) return { args };
  return { args: [...SHELL_ARGS], input: `${toShellCommandLine(args)}\nexit\n` };
}
