import { spawn } from 'node:child_process';
import { terminalCommands, type TerminalCommand } from './terminalCommands';

/** Opens the user's terminal in `path`, trying the fallbacks when the preferred one isn't installed. */
export async function openTerminal(path: string): Promise<void> {
  for (const candidate of terminalCommands(process.platform, process.env, path)) {
    if (await launch(candidate, path)) return;
  }
  throw new Error('No terminal app was found.');
}

function launch({ command, args, exits }: TerminalCommand, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    // A launcher is hidden: its own console (cmd's, running `start`) would flash on Windows. A terminal must show.
    const child = spawn(command, args, { cwd, detached: !exits, stdio: 'ignore', windowsHide: exits });
    child.once('error', () => resolve(false));
    if (exits) {
      child.once('exit', (code) => resolve(code === 0));
      return;
    }
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
