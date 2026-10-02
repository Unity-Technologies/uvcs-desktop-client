import { spawnCommand } from './spawnCommand';

/** How to start an app on a path, run by `launchApp` without a shell. */
export interface LaunchCommand {
  command: string;
  args: string[];
  /** The folder it starts in: a terminal opens there. */
  cwd?: string;
  /** Launchers like `open` and cmd's `start` exit at once, failing when the app is missing; apps themselves keep running. */
  exits: boolean;
  /** Its arguments are already quoted for `cmd.exe` (`spawnCommand`, cmd's `start`). */
  verbatim?: boolean;
}

/** macOS: the app bundle opens the path (`open -a`), as Finder would, in its window if it's running. */
export function macOpen(bundle: string, path: string): LaunchCommand {
  return { command: 'open', args: ['-a', bundle, path], exits: true };
}

/** A program run on the path; Windows `.cmd` launchers through `cmd.exe` (`spawnCommand`). */
export function runProgram(platform: NodeJS.Platform, program: string, args: string[], cwd?: string): LaunchCommand {
  const { command, commandArgs, verbatim } = spawnCommand(platform, program, args);
  return { command, args: commandArgs, exits: false, ...(cwd && { cwd }), ...(verbatim && { verbatim }) };
}
