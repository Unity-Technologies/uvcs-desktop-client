import type { CmClient } from './CmClient';

/**
 * Commands that only read this machine: client configuration, workspace metadata, the disk. `status` scans the disk
 * (it only greets the server); everything else asks the server.
 */
const LOCAL_COMMANDS = new Set(['status', 'getworkspacefrompath', 'gwp', 'wi', 'workspaceinfo', 'lwk', 'profile', 'version', 'location', 'changelist', 'shell']);

export function isServerCommand(args: readonly string[]): boolean {
  const [command = '', subcommand] = args;
  if (command === 'workspace' || command === 'wk') return subcommand !== 'list';
  return !LOCAL_COMMANDS.has(command);
}

/** The development budget: the same server command more often than this within the window is probably a regression. */
export const REPEATED_COMMAND_BUDGET = { maxRuns: 2, windowMs: 10_000 };

/**
 * Spots a server command run again and again: duplicated queries, focus refetches, per-row lookups. `record` returns
 * true once per burst, when a command goes over the budget.
 */
export class RepeatedCommandDetector {
  private readonly runs = new Map<string, number[]>();

  constructor(private readonly budget = REPEATED_COMMAND_BUDGET) {}

  record(command: string, at: number): boolean {
    const recent = (this.runs.get(command) ?? []).filter((time) => at - time < this.budget.windowMs);
    recent.push(at);
    this.runs.set(command, recent);
    if (this.runs.size > 1000) this.forgetOlderThan(at - this.budget.windowMs);
    return recent.length === this.budget.maxRuns + 1;
  }

  private forgetOlderThan(time: number): void {
    for (const [command, times] of this.runs) if (times.every((run) => run < time)) this.runs.delete(command);
  }
}

/** Development builds: warns in the console when a server command goes over the budget. */
export function warnOnRepeatedServerCommands(cm: Pick<CmClient, 'onCommandStarted'>): void {
  const detector = new RepeatedCommandDetector();
  cm.onCommandStarted(({ args, cwd }) => {
    if (!isServerCommand(args) || !detector.record(`${cwd}\n${args.join(' ')}`, Date.now())) return;
    const { maxRuns, windowMs } = REPEATED_COMMAND_BUDGET;
    console.warn(`[server budget] cm ${args.join(' ')} ran more than ${maxRuns} times in ${windowMs / 1000} s (${cwd}). See "Server budget" in docs/ARCHITECTURE.md.`);
  });
}
