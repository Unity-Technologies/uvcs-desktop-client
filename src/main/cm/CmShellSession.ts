import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CmResult } from './CmResult';
import { changesWorkspace } from '../watch/changesWorkspace';
import { OutputBuffer } from './OutputBuffer';
import { SHELL_ARGS, toShellCommandLine } from './shellCommandLine';
import { resultLineAtEnd } from './shellResultLine';
/** A trailing line without a newline that looks like a question, e.g. "Select your system [0-1]:". */
const PROMPT_LIKE_TAIL = /^[^<].*(\[[^\]]*\]|[:?])\s*$/;
/** Longer last lines are output (e.g. `--format` records), not a question. */
const MAX_PROMPT_LENGTH = 300;
/** How long output may pause on a question-like line before it counts as a prompt. */
const PROMPT_STALL_MS = 1500;
const READ_TIMEOUT_MS = 120_000;
/** A write of few paths can still touch a whole tree (removing or moving a folder); a stalled prompt is caught long before either timeout. */
const WRITE_TIMEOUT_MS = 30 * 60_000;
/** Local and instant: its answer tells the process is up. */
const STARTUP_PROBE = ['version'];

interface PendingCommand {
  commandLine: string;
  timeoutMs: number;
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
  /** Whether the current process answered a command yet; until then it's starting, which takes about a second. */
  private answered = false;

  constructor(
    private readonly cmPath: string,
    private readonly cwd: string,
    private readonly promptStallMs = PROMPT_STALL_MS,
  ) {}

  get pendingCount(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /** Whether a command sent now runs at once, rather than after the process starts. */
  get isReady(): boolean {
    return this.process !== null && this.answered;
  }

  /**
   * Starts the `cm shell` process ahead of time, if it isn't running; its startup is the slowest part of a first query.
   * Settles once the process answered (or failed) its first command.
   */
  async start(): Promise<void> {
    if (this.process) return;
    this.ensureProcess();
    await this.run(STARTUP_PROBE).catch(() => {});
  }

  run(args: string[]): Promise<CmResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ commandLine: toShellCommandLine(args), timeoutMs: shellCommandTimeoutMs(args), resolve, reject });
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
    this.timeoutTimer = setTimeout(() => this.abortRunning('The cm command took too long and was stopped.'), this.running.timeoutMs);
    this.ensureProcess().stdin.write(`${this.running.commandLine}\n`);
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process) return this.process;

    const child = spawn(this.cmPath, SHELL_ARGS, { cwd: this.cwd, windowsHide: true });
    this.answered = false;
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
    // Windows ends lines with CRLF: the last one's CR stays before the result line's LF.
    const text = this.buffer.textBefore(length - tail.length + result.outputEnd).replaceAll('\r\n', '\n');
    const output = text.endsWith('\r') ? text.slice(0, -1) : text;
    this.buffer.clear();
    this.answered = true;
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
      this.promptStallMs,
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

/** How long a command may run: reads are quick, while writes to thousands of files take minutes. */
export function shellCommandTimeoutMs(args: readonly string[]): number {
  return changesWorkspace(args) ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS;
}
