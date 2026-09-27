import { spawn } from 'node:child_process';

/**
 * The one place a merge tool is started, and only for the user's explicit "Resolve in…" on one file (see
 * `noExternalUi.test.ts`): background merges never open anything.
 */

export interface ToolRun {
  /** Null when it was stopped by a signal (the user stopped waiting). */
  exitCode: number | null;
  /** The end of what it wrote to stderr, to explain a failure. */
  errorOutput: string;
  /** How long it ran. */
  seconds: number;
}

/**
 * Runs the tool and waits until it exits. Its output is a pipe, which is what keeps `opendiff` waiting for FileMerge.
 * Rejects when it can't be started at all.
 */
export function launchMergeTool(executable: string, args: string[], signal: AbortSignal): Promise<ToolRun> {
  const { command, commandArgs, verbatim } = commandLine(process.platform, executable, args);
  const started = Date.now();
  const ran = (exitCode: number | null, errorOutput: string): ToolRun => ({ exitCode, errorOutput: errorOutput.trim(), seconds: (Date.now() - started) / 1000 });
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsVerbatimArguments: verbatim, signal, killSignal: 'SIGTERM' });
    let errorOutput = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) => (errorOutput = (errorOutput + chunk.toString()).slice(-2000)));
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (error.name === 'AbortError') return;
      reject(new Error(`Couldn't start ${executable}: ${error.code === 'ENOENT' ? 'it is not there anymore' : error.message}`));
    });
    child.once('close', (exitCode) => resolve(ran(exitCode, errorOutput)));
    // Stopped: done once it exits, without waiting for what it started and still holds its output (a launcher script's
    // app), which would keep the file "open" after the user moved on.
    child.once('exit', () => {
      if (!signal.aborted) return;
      child.stdout.destroy();
      child.stderr.destroy();
      resolve(ran(null, errorOutput));
    });
  });
}

/** Activates the macOS app bundle of a tool that is open, bringing its window forward. */
export function activateApp(bundle: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('open', ['-a', bundle], { stdio: 'ignore' });
    child.once('error', reject);
    child.once('close', () => resolve());
  });
}

/**
 * Windows runs `.cmd` launchers (VS Code's `code.cmd`, JetBrains Toolbox scripts) only through `cmd.exe`, which reads
 * the whole line: every argument is quoted, without the characters it would still interpret. Arguments are the app's
 * temp paths and version names, so nothing needed is lost.
 */
export function commandLine(platform: NodeJS.Platform, executable: string, args: string[]): { command: string; commandArgs: string[]; verbatim: boolean } {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(executable)) return { command: executable, commandArgs: args, verbatim: false };
  const quote = (arg: string): string => `"${arg.replace(/["%^&|<>!]/g, '')}"`;
  return { command: 'cmd.exe', commandArgs: ['/d', '/s', '/c', `"${[executable, ...args].map(quote).join(' ')}"`], verbatim: true };
}
