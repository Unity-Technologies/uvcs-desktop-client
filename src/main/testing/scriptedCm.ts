import type { AppSettings } from '@shared/domain/settings';
import type { CmClient, CmRunOptions } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';

/** How a command reached `cm`: a pooled shell (`query`) or a process of its own (`execute`). */
export type CmRoute = 'query' | 'execute';

export interface RecordedCommand {
  route: CmRoute;
  /** The arguments joined by spaces, as a person reads the command line. */
  line: string;
  args: string[];
  options: CmRunOptions;
}

/** An answer to a command: `cm`'s output, or a function that computes it (and may throw, as a failing `cm` does). */
export type CmAnswer = string | ((args: string[], route: CmRoute) => string | Promise<string>);

/**
 * A `CmClient` that answers from a script and records every command it was asked. The script maps command-line
 * prefixes to answers; the longest prefix matching the command wins (`status --header --xml` over `status`), and a
 * command no prefix matches fails, so a test notices any command it didn't expect.
 */
export function scriptedCm(script: Record<string, CmAnswer>) {
  const commands: RecordedCommand[] = [];
  const prefixes = Object.keys(script).sort((a, b) => b.length - a.length);

  const run = async (route: CmRoute, args: string[], options: CmRunOptions = {}): Promise<string> => {
    const line = args.join(' ');
    commands.push({ route, line, args, options });
    const prefix = prefixes.find((candidate) => line === candidate || line.startsWith(`${candidate} `));
    if (prefix === undefined) throw new Error(`Unexpected command: cm ${line}`);
    const answer = script[prefix]!;
    return typeof answer === 'string' ? answer : answer(args, route);
  };

  const cm = {
    query: (args: string[], options?: CmRunOptions) => run('query', args, options),
    execute: (args: string[], options?: CmRunOptions) => run('execute', args, options),
  } as unknown as CmClient;

  return {
    cm,
    commands,
    /** The command lines run, in order. */
    lines: (): string[] => commands.map((command) => command.line),
    /** The command lines run as processes of their own, in order. */
    executed: (): string[] => commands.filter((command) => command.route === 'execute').map((command) => command.line),
    /** Whether a command starting with `prefix` ran. */
    ran: (prefix: string): boolean => commands.some((command) => command.line === prefix || command.line.startsWith(`${prefix} `)),
  };
}

/** A settings store kept in memory, starting from `initial`. */
export function memorySettings(initial: Partial<AppSettings> = {}): SettingsStore {
  let settings = { switchShelves: [], ...initial } as unknown as AppSettings;
  return {
    get: () => settings,
    update: (changes: Partial<AppSettings>) => (settings = { ...settings, ...changes }),
  } as unknown as SettingsStore;
}

/** An operation context that records the steps and activities it is told about. */
export function recordingContext(signal: AbortSignal = new AbortController().signal) {
  const steps: string[] = [];
  const activities: string[] = [];
  const context: OperationContext = {
    signal,
    reportProgress: (activity) => activities.push(activity),
    beginStep: (label, index, count) => steps.push(`${index}/${count} ${label}`),
    progressOf: () => () => {},
  };
  return { context, steps, activities };
}
