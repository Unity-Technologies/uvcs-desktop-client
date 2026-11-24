/**
 * The smoke test's duplicate check (scripts/e2e/README.md, "Duplicate server commands"): the same command line, sent
 * twice from the same folder, within one step, is one read too many, unless the step says what reads it again (an
 * operation, a refresh). It reads the fake `cm`'s log (`scripts/e2e/fakeCm/cm.cjs`), where the smoke test writes a
 * line as each step starts. Not the build's, but here, where the tests and the type check of the scripts' logic look.
 * `.mts`: the smoke test imports it as a module.
 */

/** A command the fake `cm` answered: its arguments, the folder it ran in, and whether the fake knew it. */
export interface LoggedCommand {
  args: string[];
  cwd: string;
  known: boolean;
}

/** Where a step starts, and, when the step reads something again on purpose, what does (`'Refresh'`). */
export interface StepStart {
  step: string;
  rereads?: string;
}

export type CommandLogLine = LoggedCommand | StepStart;

export interface LoggedStep extends StepStart {
  commands: LoggedCommand[];
}

/** A server command sent more than once within one step. */
export interface DuplicateCommand {
  step: string;
  commandLine: string;
  cwd: string;
  times: number;
}

/** A duplicate still on `main`, allowed until a change removes it: in `step`, a command line starting with `command`. */
export interface AllowedDuplicate {
  step: string;
  command: string;
  /** The issue and what removes it. */
  why: string;
}

export interface DuplicateReport {
  /** Duplicates no entry allows: the smoke test fails on them. */
  failures: DuplicateCommand[];
  /** Allowed entries that matched nothing in the run: the change that removes them merged, so they can go. */
  unused: AllowedDuplicate[];
}

/** The step commands logged before any step started belong to: the app's start. */
export const BEFORE_THE_FIRST_STEP = 'Start';

/** The log as its lines, one JSON object each. */
export function readCommandLog(text: string): CommandLogLine[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CommandLogLine);
}

/** The commands the log holds, by the step they were sent in. */
export function commandsByStep(lines: readonly CommandLogLine[]): LoggedStep[] {
  const steps: LoggedStep[] = [{ step: BEFORE_THE_FIRST_STEP, commands: [] }];
  for (const line of lines) {
    if ('step' in line) steps.push({ ...line, commands: [] });
    else steps.at(-1)!.commands.push(line);
  }
  return steps;
}

/**
 * Whether a command asks the server (`needsSignIn` in main/cm/repeatedCommands.ts, whose list it copies: this script
 * can't import the app's code). `cm status` asks for its header unless told not to work it out (`--compact`, `--cset`,
 * `--format`).
 */
export function needsServer(args: readonly string[]): boolean {
  const [command = '', subcommand] = args;
  if (command === 'workspace' || command === 'wk') return subcommand !== 'list';
  if (command === 'status') return !args.some((arg) => arg === '--compact' || arg.startsWith('--cset') || arg.startsWith('--format'));
  return !LOCAL_COMMANDS.has(command);
}

const LOCAL_COMMANDS = new Set(['getworkspacefrompath', 'gwp', 'wi', 'workspaceinfo', 'lwk', 'profile', 'version', 'location', 'changelist']);

/**
 * The incoming check's `cm find` (`incomingChangesetsArgs`, or `branchHeadArgs` for a partial workspace): the one read
 * on a timer (a poll every minute, and again as the window gains focus once 20 s old), so it may run in any step, even
 * twice in one. The comparison leaves it out; its tests hold it to the commands the app builds.
 */
export function isIncomingCheck(args: readonly string[]): boolean {
  const [command, object, query = '', format] = args;
  return (
    command === 'find' &&
    object === 'changeset' &&
    / order by changesetid desc limit \d+$/.test(query) &&
    (format === `--format={changesetid}${FIELD}{owner}${RECORD}` || format === `--format={changesetid}${RECORD}`)
  );
}

/** `--format`'s separators (`recordFormat` in main/cm/formatRecords.ts). */
const FIELD = '\u001f';
const RECORD = '\u001e';

/** Each server command sent more than once in the step from the same folder, in the order first sent. */
export function duplicatesIn(step: LoggedStep): DuplicateCommand[] {
  const times = new Map<string, DuplicateCommand>();
  for (const { args, cwd } of step.commands) {
    if (!needsServer(args) || isIncomingCheck(args)) continue;
    const commandLine = args.join(' ');
    const key = `${cwd}\n${commandLine}`;
    const seen = times.get(key) ?? { step: step.step, commandLine, cwd, times: 0 };
    seen.times += 1;
    times.set(key, seen);
  }
  return [...times.values()].filter((command) => command.times > 1);
}

/** The duplicates of every step that doesn't say what reads again, less those `allowed`, and the entries never used. */
export function duplicateReport(steps: readonly LoggedStep[], allowed: readonly AllowedDuplicate[]): DuplicateReport {
  const used = new Set<AllowedDuplicate>();
  const failures: DuplicateCommand[] = [];
  for (const duplicate of steps.filter((step) => step.rereads === undefined).flatMap(duplicatesIn)) {
    const entry = allowed.find(({ step, command }) => duplicate.step === step && duplicate.commandLine.startsWith(command));
    if (entry) used.add(entry);
    else failures.push(duplicate);
  }
  return { failures, unused: allowed.filter((entry) => !used.has(entry)) };
}

/** A command line as a person reads it: `--format`'s field separators made visible. */
export function readableCommandLine(commandLine: string): string {
  return commandLine.replace(/[\u001e\u001f]/g, '|');
}
