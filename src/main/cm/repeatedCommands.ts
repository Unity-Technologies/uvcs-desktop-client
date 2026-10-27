import type { CmClient } from './CmClient';
import { commandLineForLog } from './hideSecrets';

/**
 * Commands that only read this machine: client configuration, workspace metadata, the disk. `status` scans the disk
 * (it only greets the server, but for its header: ARCHITECTURE.md "`cm status` asks the server for its header");
 * everything else asks the server.
 */
const LOCAL_COMMANDS = new Set(['status', 'getworkspacefrompath', 'gwp', 'wi', 'workspaceinfo', 'lwk', 'profile', 'version', 'location', 'changelist', 'trackevent']);

export function isServerCommand(args: readonly string[]): boolean {
  const [command = '', subcommand] = args;
  if (command === 'workspace' || command === 'wk') return subcommand !== 'list';
  return !LOCAL_COMMANDS.has(command);
}

/** The development budget: the same server command more often than this within the window is probably a regression. */
const REPEATED_COMMAND_BUDGET = { maxRuns: 2, windowMs: 10_000 };

/**
 * Spots a server command run again and again: duplicated queries, focus refetches, per-row lookups. `record` returns
 * true once per burst, when a command goes over the budget.
 */
export class RepeatedCommandDetector {
  /** The recent runs of each command, the command run longest ago first (a `Map` keeps the order keys are set in). */
  private readonly runs = new Map<string, number[]>();

  constructor(private readonly budget = REPEATED_COMMAND_BUDGET) {}

  record(command: string, at: number): boolean {
    const recent = (this.runs.get(command) ?? []).filter((time) => at - time < this.budget.windowMs);
    recent.push(at);
    this.runs.delete(command);
    this.runs.set(command, recent);
    this.forgetOlderThan(at - this.budget.windowMs);
    return recent.length === this.budget.maxRuns + 1;
  }

  /**
   * Drops the commands last run before `time`: they come first, so it stops at the first one run since. Each command is
   * dropped once, however many there are: a big merge runs thousands.
   */
  private forgetOlderThan(time: number): void {
    for (const [command, times] of this.runs) {
      if (times.at(-1)! >= time) return;
      this.runs.delete(command);
    }
  }
}

/** Development builds: warns in the console when a server command goes over the budget. */
export function warnOnRepeatedServerCommands(cm: Pick<CmClient, 'onCommandStarted'>): void {
  const detector = new RepeatedCommandDetector();
  cm.onCommandStarted(({ args, cwd }) => {
    if (!isServerCommand(args) || !detector.record(`${cwd}\n${args.join(' ')}`, Date.now())) return;
    const { maxRuns, windowMs } = REPEATED_COMMAND_BUDGET;
    console.warn(`[server budget] ${commandLineForLog(args)} ran more than ${maxRuns} times in ${windowMs / 1000} s (${cwd}). See "Server budget" in docs/ARCHITECTURE.md.`);
  });
}
