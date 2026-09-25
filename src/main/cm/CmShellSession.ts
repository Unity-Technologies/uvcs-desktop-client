import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CmResult } from './CmResult';
import { toShellCommandLine } from './shellCommandLine';

const COMMAND_RESULT_LINE = /(?:^|\n)CommandResult (-?\d+)\r?\n/;

interface PendingCommand {
  commandLine: string;
  resolve: (result: CmResult) => void;
  reject: (error: Error) => void;
}

/**
 * A long-lived `cm shell` process bound to one working directory.
 * Commands run one at a time; each one's output ends with a `CommandResult <code>` line.
 */
export class CmShellSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly queue: PendingCommand[] = [];
  private running: PendingCommand | null = null;
  private buffer = '';

  constructor(
    private readonly cmPath: string,
    private readonly cwd: string,
  ) {}

  get pendingCount(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  run(args: string[]): Promise<CmResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ commandLine: toShellCommandLine(args), resolve, reject });
      this.runNext();
    });
  }

  dispose(): void {
    this.process?.stdin.end('exit\n');
    this.process = null;
    this.failAll(new Error('cm shell session was closed'));
  }

  private runNext(): void {
    if (this.running || this.queue.length === 0) return;

    this.running = this.queue.shift()!;
    this.ensureProcess().stdin.write(`${this.running.commandLine}\n`);
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process) return this.process;

    const child = spawn(this.cmPath, ['shell'], { cwd: this.cwd, windowsHide: true });
    child.stdout.on('data', (data: Buffer) => this.onOutput(data.toString('utf8')));
    child.stderr.on('data', (data: Buffer) => this.onOutput(data.toString('utf8')));
    child.on('error', (error) => this.onProcessEnded(child, error));
    child.on('close', () => this.onProcessEnded(child, new Error('cm shell exited unexpectedly')));
    this.process = child;
    return child;
  }

  private onOutput(text: string): void {
    this.buffer += text;
    const match = COMMAND_RESULT_LINE.exec(this.buffer);
    if (!match || !this.running) return;

    const output = this.buffer.slice(0, match.index).replace(/\r\n/g, '\n');
    this.buffer = this.buffer.slice(match.index + match[0].length);
    const finished = this.running;
    this.running = null;
    finished.resolve({ output, exitCode: Number(match[1]) });
    this.runNext();
  }

  private onProcessEnded(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (child !== this.process) return;
    this.process = null;
    this.buffer = '';
    this.failAll(error);
  }

  private failAll(error: Error): void {
    const pending = [...(this.running ? [this.running] : []), ...this.queue.splice(0)];
    this.running = null;
    pending.forEach((command) => command.reject(error));
  }
}
