import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CmResult } from './CmResult';
import { toShellCommandLine } from './shellCommandLine';

const COMMAND_RESULT_LINE = /(?:^|\n)CommandResult (-?\d+)\r?\n/;
/** A trailing line without a newline that looks like a question, e.g. "Select your system [0-1]:". */
const PROMPT_LIKE_TAIL = /^[^<].*(\[[^\]]*\]|[:?])\s*$/;
const PROMPT_STALL_MS = 1500;
const COMMAND_TIMEOUT_MS = 120_000;

interface PendingCommand {
  commandLine: string;
  resolve: (result: CmResult) => void;
  reject: (error: Error) => void;
}

/**
 * A long-lived `cm shell` process bound to one working directory.
 * Commands run one at a time; each one's output ends with a `CommandResult <code>` line.
 *
 * `cm` may stop to ask a question (typically credentials). Inside a shell it would read the
 * next queued commands as answers, so a stalled prompt or a timeout kills the process: the
 * running command fails and the queued ones continue on a fresh process.
 */
export class CmShellSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly queue: PendingCommand[] = [];
  private running: PendingCommand | null = null;
  private buffer = '';
  private promptTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cmPath: string,
    private readonly cwd: string,
  ) {}

  get pendingCount(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /** Starts the `cm shell` process ahead of time; its startup is the slowest part of a first query. */
  start(): void {
    this.ensureProcess();
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
    this.clearTimers();
    const pending = [...(this.running ? [this.running] : []), ...this.queue.splice(0)];
    this.running = null;
    pending.forEach((command) => command.reject(new Error('cm shell session was closed')));
  }

  private runNext(): void {
    if (this.running || this.queue.length === 0) return;

    this.running = this.queue.shift()!;
    this.timeoutTimer = setTimeout(() => this.abortRunning('The cm command took too long and was stopped.'), COMMAND_TIMEOUT_MS);
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
    this.watchForPrompt();

    const match = COMMAND_RESULT_LINE.exec(this.buffer);
    if (!match || !this.running) return;

    const output = this.buffer.slice(0, match.index).replace(/\r\n/g, '\n');
    this.buffer = this.buffer.slice(match.index + match[0].length);
    this.finishRunning().resolve({ output, exitCode: Number(match[1]) });
    this.runNext();
  }

  private watchForPrompt(): void {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    this.promptTimer = null;
    const lastLine = this.buffer.slice(this.buffer.lastIndexOf('\n') + 1);
    if (!lastLine || !PROMPT_LIKE_TAIL.test(lastLine)) return;

    this.promptTimer = setTimeout(
      () => this.abortRunning(`cm is waiting for input ("${lastLine.trim()}"). Check your credentials for this server.`),
      PROMPT_STALL_MS,
    );
  }

  /** Kills the process (cm ignores SIGTERM while prompting), fails the running command and continues with the queue. */
  private abortRunning(reason: string): void {
    const child = this.process;
    this.process = null;
    this.buffer = '';
    child?.kill('SIGKILL');
    if (this.running) this.finishRunning().reject(new Error(reason));
    this.runNext();
  }

  private finishRunning(): PendingCommand {
    const finished = this.running!;
    this.running = null;
    this.clearTimers();
    return finished;
  }

  private onProcessEnded(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (child !== this.process) return;
    this.process = null;
    this.buffer = '';
    if (this.running) this.finishRunning().reject(error);
    this.runNext();
  }

  private clearTimers(): void {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.promptTimer = null;
    this.timeoutTimer = null;
  }
}
