import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CmResult } from './CmResult';
import { OutputBuffer } from './OutputBuffer';
import { toShellCommandLine } from './shellCommandLine';

const RESULT_LINE = /^CommandResult (-?\d+)\r?\n$/;
/** Longer than any `CommandResult <code>` line. */
const RESULT_LINE_ROOM = 40;
/** A trailing line without a newline that looks like a question, e.g. "Select your system [0-1]:". */
const PROMPT_LIKE_TAIL = /^[^<].*(\[[^\]]*\]|[:?])\s*$/;
/** Longer last lines are output (e.g. `--format` records), not a question. */
const MAX_PROMPT_LENGTH = 300;
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
  private readonly buffer = new OutputBuffer(MAX_PROMPT_LENGTH + 1);
  /** Characters received so far, to tell whether output came in while a prompt timer was pending. */
  private received = 0;
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
    // What a killed process still had in its pipes must not end up in the output of the next command.
    const onData = (text: string) => child === this.process && this.onOutput(text);
    // Decoded by the streams, so a character split between two chunks stays whole.
    child.stdout.setEncoding('utf8').on('data', onData);
    child.stderr.setEncoding('utf8').on('data', onData);
    child.on('error', (error) => this.onProcessEnded(child, error));
    child.on('close', () => this.onProcessEnded(child, new Error('cm shell exited unexpectedly')));
    this.process = child;
    return child;
  }

  private onOutput(text: string): void {
    this.buffer.append(text);
    this.received += text.length;
    this.watchForPrompt();
    if (!this.running || !resultLineAtEnd(this.buffer.tail)) return;

    // A comment can hold a `CommandResult 0` line too (codice's do): the real one is the last output, with nothing
    // more in the pipe. `setImmediate` lets output already waiting be read first.
    const receivedBefore = this.received;
    setImmediate(() => {
      if (this.received === receivedBefore) this.finishIfDone();
    });
  }

  private finishIfDone(): void {
    const { tail, length } = this.buffer;
    const result = resultLineAtEnd(tail);
    if (!result || !this.running) return;

    // Not a regular expression: V8 keeps the last string one ran on, which would hold the whole output in memory.
    const output = this.buffer.textBefore(length - tail.length + result.index).replaceAll('\r\n', '\n');
    this.buffer.clear();
    this.finishRunning().resolve({ output, exitCode: result.exitCode });
    this.runNext();
  }

  private watchForPrompt(): void {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    this.promptTimer = null;
    const { tail } = this.buffer;
    const newline = tail.lastIndexOf('\n');
    if (newline < 0 && this.buffer.length > MAX_PROMPT_LENGTH) return;
    const lastLine = tail.slice(newline + 1);
    if (!lastLine || !PROMPT_LIKE_TAIL.test(lastLine)) return;

    // Output that just paused mid-line on a `:` (a date, a path) is not a prompt. When the main process was busy,
    // the timer can fire before the output that came meanwhile is read: `setImmediate` reads it first.
    const receivedBefore = this.received;
    this.promptTimer = setTimeout(
      () =>
        setImmediate(() => {
          if (this.received !== receivedBefore || !this.running) return;
          this.abortRunning(`cm is waiting for input ("${lastLine.trim()}"). Check your credentials for this server.`);
        }),
      PROMPT_STALL_MS,
    );
  }

  /** Kills the process (cm ignores SIGTERM while prompting), fails the running command and continues with the queue. */
  private abortRunning(reason: string): void {
    const child = this.process;
    this.process = null;
    this.buffer.clear();
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
    this.buffer.clear();
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

/**
 * The `CommandResult <code>` line `cm shell` ends each command's output with, when the buffer ends with it: where it
 * starts and the exit code. Only the end is looked at, so huge outputs arriving in hundreds of chunks stay cheap.
 */
export function resultLineAtEnd(buffer: string): { index: number; exitCode: number } | null {
  const tailStart = Math.max(0, buffer.length - RESULT_LINE_ROOM);
  const lineInTail = buffer.slice(tailStart).lastIndexOf('CommandResult ');
  if (lineInTail < 0) return null;
  const index = tailStart + lineInTail;
  if (index > 0 && buffer[index - 1] !== '\n') return null;
  const match = RESULT_LINE.exec(buffer.slice(index));
  return match ? { index: index > 0 ? index - 1 : 0, exitCode: Number(match[1]) } : null;
}
